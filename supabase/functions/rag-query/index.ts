/**
 * Edge Function: rag-query (Version avec Mémoire Conversationnelle)
 *
 * Fonctionnalités:
 * - Recherche sémantique dans les rapports indexés
 * - Mémoire conversationnelle (historique des messages)
 * - Support des clarifications et questions de suivi
 * - Sauvegarde automatique de l'historique
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Fonction pour créer un embedding avec OpenAI
async function createEmbedding(text) {
   const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
   const response = await fetch('https://api.openai.com/v1/embeddings', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${openaiApiKey}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       model: 'text-embedding-3-small',
       input: text
     })
   });
   if (!response.ok) {
     throw new Error(`OpenAI API error: ${response.statusText}`);
   }
   const data = await response.json();
   return data.data[0].embedding;
 }
 serve(async (req)=>{
   if (req.method === 'OPTIONS') {
     return new Response('ok', {
       status: 200,
       headers: corsHeaders
     });
   }
   try {
     const { question, user_id, conversation_id } = await req.json();
     if (!question || !user_id) {
       throw new Error('question and user_id are required');
     }
     const supabaseUrl = Deno.env.get('SUPABASE_URL');
     const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
     const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
     console.log(`🔍 Query from user: ${user_id}`);
     console.log(`❓ Question: ${question}`);
     console.log(`💬 Conversation ID: ${conversation_id || 'New conversation'}`);
     // 1. Récupérer le client_id
     const { data: client, error: clientError } = await supabase.from('clients').select('id').eq('user_id', user_id).single();
     if (clientError || !client) {
       throw new Error('Client not found');
     }
     console.log(`👤 Client ID: ${client.id}`);
     // 2. Gérer la conversation (créer ou récupérer)
     let currentConversationId = conversation_id;
     let conversationHistory = [];
     if (conversation_id) {
       // Récupérer l'historique de la conversation
       console.log('📜 Fetching conversation history...');
       const { data: history, error: historyError } = await supabase.rpc('get_conversation_history', {
         p_conversation_id: conversation_id,
         p_limit: 10
       });
       if (!historyError && history) {
         conversationHistory = history.map((msg)=>({
             role: msg.role,
             content: msg.content
           }));
         console.log(`📚 Found ${conversationHistory.length} previous messages`);
       }
     } else {
       // Créer une nouvelle conversation
       console.log('🆕 Creating new conversation...');
       const { data: newConvId, error: convError } = await supabase.rpc('create_conversation', {
         p_user_id: user_id,
         p_client_id: client.id,
         p_titre: null // Sera généré automatiquement
       });
       if (convError) {
         console.error('Error creating conversation:', convError);
         throw convError;
       }
       currentConversationId = newConvId;
       console.log(`✅ New conversation created: ${currentConversationId}`);
     }
     // 3. Reformuler la question si nécessaire avec le contexte de l'historique
     let reformulatedQuestion = question;

     if (conversationHistory.length > 0) {
       console.log('🔄 Reformulating question with conversation context...');

       // Récupérer les 3 derniers messages de l'historique
       const recentHistory = conversationHistory.slice(-6); // 3 paires user/assistant
       const historyText = recentHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n');

       const reformulationPrompt = `Tu es un assistant qui reformule des questions en utilisant le contexte d'une conversation.

Historique de la conversation :
${historyText}

Nouvelle question de l'utilisateur : "${question}"

Instructions :
1. Si la question fait référence à quelque chose dans l'historique (ex: "et pour le 17?", "détaille le point 2"), reformule-la pour qu'elle soit autonome et complète
2. Si la question est déjà complète et autonome, retourne-la telle quelle
3. Garde le même sens et la même intention
4. Retourne UNIQUEMENT la question reformulée, sans texte supplémentaire

Exemples :
- Historique: "user: Quelles sont les tendances du 14 novembre?" → Question: "et pour le 17?" → Reformulation: "Quelles sont les dernières tendances pour le 17 novembre?"
- Question complète: "Quelles sont les nouvelles de l'IA?" → Reformulation: "Quelles sont les nouvelles de l'IA?"`;

       try {
         const reformResponse = await fetch('https://api.openai.com/v1/chat/completions', {
           method: 'POST',
           headers: {
             'Authorization': `Bearer ${openaiApiKey}`,
             'Content-Type': 'application/json'
           },
           body: JSON.stringify({
             model: 'gpt-4o-mini',
             messages: [
               { role: 'system', content: 'Tu es un assistant qui reformule des questions pour les rendre autonomes et complètes.' },
               { role: 'user', content: reformulationPrompt }
             ],
             temperature: 0.3,
             max_tokens: 150
           })
         });

         if (reformResponse.ok) {
           const reformData = await reformResponse.json();
           reformulatedQuestion = reformData.choices[0].message.content.trim();
           console.log(`📝 Question reformulée: "${reformulatedQuestion}"`);
         } else {
           console.log('⚠️ Reformulation failed, using original question');
         }
       } catch (reformError) {
         console.error('❌ Error during reformulation:', reformError);
         console.log('⚠️ Using original question');
       }
     }

     // 4. Créer l'embedding de la question (reformulée si applicable)
     console.log('🔄 Creating question embedding...');
     const questionEmbedding = await createEmbedding(reformulatedQuestion);
     // 5. Rechercher les chunks similaires (paramètres élargis pour plus de rappel)
     console.log('🔎 Searching similar chunks...');
     const { data: chunks, error: searchError } = await supabase.rpc('search_rapport_chunks', {
       query_embedding: questionEmbedding,
       user_client_id: client.id,
       match_threshold: 0.2,  // Threshold plus bas pour capturer plus de résultats
       match_count: 30        // Plus de chunks pour laisser le LLM re-ranking choisir
     });
     if (searchError) {
       console.error('Search error:', searchError);
       throw searchError;
     }
     console.log(`📚 Found ${chunks?.length || 0} relevant chunks`);
     // Logger les scores de similarité
     if (chunks && chunks.length > 0) {
       console.log('📊 Similarity scores:');
       chunks.forEach((chunk, i)=>{
         console.log(`  ${i + 1}. Score: ${chunk.similarity?.toFixed(3) || 'N/A'} - ${chunk.metadata?.titre || 'Sans titre'} - Date: ${chunk.metadata?.date_rapport}`);
       });
     }

     // 6. Utiliser un LLM pour évaluer la pertinence des sources
     let relevantChunks = chunks || [];

     if (relevantChunks.length > 0) {
       console.log(`🤖 Evaluating relevance of ${relevantChunks.length} chunks with LLM...`);

       // Préparer la liste des sources pour l'évaluation
       const sourcesForEval = relevantChunks.map((chunk, idx) => ({
         index: idx,
         titre: chunk.metadata.titre,
         date: new Date(chunk.metadata.date_rapport).toLocaleDateString('fr-FR'),
         excerpt: chunk.chunk_text.substring(0, 300) + '...' // Premier 300 caractères
       }));

       const evalPrompt = `Tu es un assistant expert qui évalue la pertinence de sources documentaires par rapport à une question.

Question de l'utilisateur : "${reformulatedQuestion}"

Sources disponibles :
${sourcesForEval.map(s => `[${s.index}] Titre: ${s.titre} | Date: ${s.date}
Extrait: ${s.excerpt}`).join('\n\n')}

Instructions CRITIQUES :
1. Si la question mentionne une date spécifique (ex: "14 novembre", "17 novembre"), tu DOIS sélectionner UNIQUEMENT les sources dont la date correspond EXACTEMENT
   - "14 novembre" → Sélectionne SEULEMENT les sources du "14 novembre" (ou "14/11" ou "2025-11-14")
   - "17 novembre" → Sélectionne SEULEMENT les sources du "17 novembre"
   - Si AUCUNE source ne correspond à la date demandée, retourne un tableau vide []

2. Si la question ne mentionne PAS de date spécifique, évalue la pertinence thématique du contenu

3. Retourne UNIQUEMENT un tableau JSON avec les indices des sources pertinentes (maximum 5 sources)

4. Classe-les par ordre de pertinence (le plus pertinent en premier)

Format de réponse (JSON uniquement, sans texte supplémentaire) :
{"relevant_indices": [2, 5, 1]}`;

       try {
         const evalResponse = await fetch('https://api.openai.com/v1/chat/completions', {
           method: 'POST',
           headers: {
             'Authorization': `Bearer ${openaiApiKey}`,
             'Content-Type': 'application/json'
           },
           body: JSON.stringify({
             model: 'gpt-4o-mini',
             messages: [
               { role: 'system', content: 'Tu es un assistant expert qui évalue la pertinence de documents. Tu réponds uniquement en JSON.' },
               { role: 'user', content: evalPrompt }
             ],
             temperature: 0.2,  // Plus déterministe pour le filtrage par date
             max_tokens: 300    // Plus de tokens pour gérer 30 sources
           })
         });

         if (evalResponse.ok) {
           const evalData = await evalResponse.json();
           let evalResult = evalData.choices[0].message.content.trim();
           console.log('🔍 LLM evaluation result:', evalResult);

           // Nettoyer la réponse (enlever les backticks markdown si présents)
           evalResult = evalResult.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

           // Parser la réponse JSON
           try {
             const parsed = JSON.parse(evalResult);
             const relevantIndices = parsed.relevant_indices || [];

             console.log(`✅ LLM selected ${relevantIndices.length} relevant sources: ${relevantIndices.join(', ')}`);

             // Filtrer et réordonner les chunks selon l'évaluation du LLM
             if (relevantIndices.length > 0) {
               relevantChunks = relevantIndices
                 .map(idx => relevantChunks[idx])
                 .filter(chunk => chunk !== undefined)
                 .slice(0, 5); // Maximum 5 sources

               console.log(`📊 Final sources after LLM filtering: ${relevantChunks.length}`);
             } else {
               // Si le LLM retourne un tableau vide, c'est une décision délibérée (ex: aucune source ne correspond à la date)
               // On respecte cette décision et on retourne 0 sources
               console.log('⚠️ LLM found no relevant sources (date mismatch or no match)');
               relevantChunks = [];
             }
           } catch (parseError) {
             console.error('❌ Failed to parse LLM response:', parseError);
             console.log('⚠️ Falling back to top 5 by similarity');
             relevantChunks = relevantChunks.slice(0, 5);
           }
         } else {
           console.error('❌ LLM evaluation failed, using top 5 by similarity');
           relevantChunks = relevantChunks.slice(0, 5);
         }
       } catch (evalError) {
         console.error('❌ Error during LLM evaluation:', evalError);
         console.log('⚠️ Falling back to top 5 by similarity');
         relevantChunks = relevantChunks.slice(0, 5);
       }
     }

     // 7. Utiliser les chunks pertinents sélectionnés par le LLM
     const topChunks = relevantChunks;

     // 8. Préparer une liste des sources avec numéros pour les citations
     const sourcesMap = topChunks.map((chunk, idx) => ({
       index: idx + 1,
       titre: chunk.metadata.titre,
       date: new Date(chunk.metadata.date_rapport).toLocaleDateString('fr-FR')
     }));

     // 9. Construire le contexte pour GPT avec numérotation CLAIRE de chaque source
     const context = topChunks.map((chunk, idx) =>
       `**SOURCE [${idx + 1}]** - ${chunk.metadata.titre} (${new Date(chunk.metadata.date_rapport).toLocaleDateString('fr-FR')})\n${chunk.chunk_text}`
     ).join('\n\n---\n\n');

     console.log(`📝 Context: ${topChunks.length} sources, ${context.length} characters`);

     const sourcesLegend = sourcesMap.length > 0
       ? "\n\n**Sources disponibles pour citation** :\n" + sourcesMap.map(s => `[${s.index}] ${s.titre} (${s.date})`).join('\n')
       : '';

     // 10. Construire les messages pour GPT avec historique
     // Adapter le prompt système selon la présence de nouveau contexte
     const hasNewContext = context.length > 0;

     const systemPrompt = hasNewContext
       ? `Tu es un assistant spécialisé dans l'analyse de veilles concurrentielles et technologiques.

 **Sources d'information** :
 Tu disposes de ${topChunks.length} sources pré-sélectionnées. Utilise UNIQUEMENT les sources pertinentes pour répondre à la question.

 **Instructions CRITIQUES pour les citations** :
 - OBLIGATOIRE : Cite les sources pertinentes en utilisant des références numérotées [1], [2], etc.
 - Chaque source dans le contexte est marquée **SOURCE [X]**
 - Place la référence [numéro] IMMÉDIATEMENT après chaque information citée
 - Exemple : "OpenAI a amélioré ChatGPT [1]" ou "Les entreprises investissent massivement [2]"
 - JAMAIS écrire : "selon le rapport" ou "(Rapport, 18 novembre)" - TOUJOURS utiliser [1], [2], [3], etc.
 - N'utilise QUE les sources qui répondent réellement à la question
 - Si une seule source suffit pour répondre complètement, utilise seulement celle-ci

 **Autres instructions** :
 - Réponds de manière claire, structurée et professionnelle
 - Utilise des bullet points pour les listes
 - Sois concis mais complet
 - Si tu ne peux pas répondre avec les informations disponibles, dis-le clairement${sourcesLegend}`
       : `Tu es un assistant spécialisé dans l'analyse de veilles concurrentielles et technologiques.

 **Contexte** :
 Cette question est une question de suivi dans une conversation en cours. Aucune nouvelle source n'est disponible.

 **Instructions** :
 - Base-toi sur l'historique de notre conversation ci-dessus pour répondre
 - NE METS AUCUNE RÉFÉRENCE [1], [2], etc. car il n'y a pas de nouvelles sources
 - Réponds en te basant sur ce que tu as déjà expliqué précédemment
 - Clarifie, détaille ou approfondit tes réponses précédentes selon la question
 - Réponds de manière claire, structurée et professionnelle
 - Utilise des bullet points pour les listes
 - Sois concis mais complet`;

     const messages = [
       {
         role: 'system',
         content: systemPrompt
       }
     ];
     // Ajouter l'historique (sauf le message actuel)
     if (conversationHistory.length > 0) {
       console.log('📖 Including conversation history in prompt');
       messages.push(...conversationHistory);
     }
     // Ajouter la question actuelle avec le contexte
     let userMessage;
     if (context.length > 0) {
       // Il y a du contexte pertinent trouvé
       userMessage = `Contexte (extraits de rapports de veille) :\n\n${context}\n\n---\n\nQuestion : ${question}`;
     } else if (conversationHistory.length > 0) {
       // Pas de contexte, mais il y a de l'historique (probablement une question de suivi)
       userMessage = `Question : ${question}\n\n(Note : Cette question semble être une question de suivi. Aucun nouveau contexte trouvé dans les rapports. Réfère-toi à l'historique de notre conversation ci-dessus pour répondre.)`;
     } else {
       // Ni contexte ni historique
       userMessage = `Question : ${question}\n\n(Note : Aucun contexte pertinent trouvé dans les rapports pour cette question.)`;
     }
     messages.push({
       role: 'user',
       content: userMessage
     });
     // 11. Générer la réponse avec GPT
     console.log('🤖 Generating answer with GPT-4...');
     const response = await fetch('https://api.openai.com/v1/chat/completions', {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${openaiApiKey}`,
         'Content-Type': 'application/json'
       },
       body: JSON.stringify({
         model: 'gpt-4o-mini',
         messages: messages,
         temperature: 0.7,
         max_tokens: 1500
       })
     });
     if (!response.ok) {
       throw new Error(`OpenAI API error: ${response.statusText}`);
     }
     const gptData = await response.json();
     const answer = gptData.choices[0].message.content;
     console.log('✅ Answer generated successfully');

     // Détecter quelles sources sont réellement utilisées dans la réponse
     const usedSourceIndices = new Set<number>();
     for (let i = 1; i <= topChunks.length; i++) {
       const regex = new RegExp(`\\[${i}\\]`, 'g');
       if (regex.test(answer)) {
         usedSourceIndices.add(i - 1); // Index 0-based
       }
     }

     console.log(`📊 Sources utilisées dans la réponse: ${Array.from(usedSourceIndices).map(i => i + 1).join(', ')}`);

     // Filtrer pour ne garder que les sources utilisées
     const usedChunks = topChunks.filter((chunk, idx) => usedSourceIndices.has(idx));
     console.log(`✅ ${usedChunks.length} sources utilisées sur ${topChunks.length} disponibles`);

     // 12. Préparer SEULEMENT les sources utilisées pour le frontend ET la persistence
     const sourcesWithFullContent = [];
     if (usedChunks.length > 0) {
       console.log(`📄 Preparing ${usedChunks.length} used sources...`);

       // Créer un mapping pour retrouver le numéro original de chaque source
       const usedSourceNumbers = Array.from(usedSourceIndices).sort((a, b) => a - b);

       for (let i = 0; i < usedChunks.length; i++) {
         const chunk = usedChunks[i];
         const originalSourceNumber = usedSourceNumbers[i] + 1; // Numéro original dans la réponse

         console.log(`  [${originalSourceNumber}] ${chunk.metadata.titre}`);
         console.log(`      PDF URL: ${chunk.metadata.pdf_url || 'NULL'}`);
         console.log(`      Rapport ID: ${chunk.metadata.rapport_id}`);

         sourcesWithFullContent.push({
           source_number: originalSourceNumber, // Garder le numéro original pour correspondre aux [1], [2] dans le texte
           titre: chunk.metadata.titre,
           date: chunk.metadata.date_rapport,
           excerpt: chunk.chunk_text,
           rapport_id: chunk.metadata.rapport_id,
           url_pdf: chunk.metadata.pdf_url || null,
           similarity: chunk.similarity
         });
       }
       console.log(`✅ Sources prepared: ${sourcesWithFullContent.length} (only used sources)`);
     }

     // 13. Sauvegarder la question et la réponse dans la base de données
     console.log('💾 Saving messages to database...');
     // Sauvegarder la question
     await supabase.rpc('add_message', {
       p_conversation_id: currentConversationId,
       p_role: 'user',
       p_content: question,
       p_metadata: {
         chunks_found: chunks?.length || 0,
         timestamp: new Date().toISOString()
       }
     });
     // Sauvegarder la réponse avec les sources complètes
     await supabase.rpc('add_message', {
       p_conversation_id: currentConversationId,
       p_role: 'assistant',
       p_content: answer,
       p_metadata: {
         model: 'gpt-4o-mini',
         sources_count: usedChunks.length,
         total_sources_available: topChunks.length,
         total_chunks_found: chunks?.length || 0,
         timestamp: new Date().toISOString(),
         sources: sourcesWithFullContent  // Sauvegarder la structure complète pour la persistence
       }
     });
     console.log('✅ Messages saved with complete sources');

     // 14. Retourner la réponse avec conversation_id
     return new Response(JSON.stringify({
       answer,
       conversation_id: currentConversationId,
       sources: sourcesWithFullContent,
       has_history: conversationHistory.length > 0
     }), {
       headers: {
         ...corsHeaders,
         'Content-Type': 'application/json'
       }
     });
   } catch (error) {
     console.error('❌ Error:', error);
     return new Response(JSON.stringify({
       error: error.message
     }), {
       status: 500,
       headers: {
         ...corsHeaders,
         'Content-Type': 'application/json'
       }
     });
   }
 });

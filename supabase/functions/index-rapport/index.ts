/**
 * Edge Function : index-rapport (Version Simplifiée - HTML)
 *
 * Utilise contenu_html (contenu complet) ou resume en fallback
 * Simple, rapide et fiable - pas besoin d'API externe
 */ import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
     const errorText = await response.text();
     throw new Error(`OpenAI API error: ${response.statusText} - ${errorText}`);
   }
   const data = await response.json();
   return data.data[0].embedding;
 }
 // Fonction pour nettoyer le HTML
 function cleanHTML(html) {
   return html.replace(/<style[^>]*>.*?<\/style>/gis, '').replace(/<script[^>]*>.*?<\/script>/gis, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();
 }
 // Fonction pour découper le texte en chunks
 function chunkText(text, maxTokens = 500) {
   const cleaned = text.replace(/\s+/g, ' ').trim();
   const sentences = cleaned.split(/[.!?]+/).filter((s)=>s.trim().length > 0);
   const chunks = [];
   let currentChunk = '';
   for (const sentence of sentences){
     const trimmedSentence = sentence.trim();
     const estimatedTokens = (currentChunk + trimmedSentence).length / 4;
     if (estimatedTokens > maxTokens && currentChunk.length > 0) {
       chunks.push(currentChunk.trim());
       currentChunk = trimmedSentence + '. ';
     } else {
       currentChunk += trimmedSentence + '. ';
     }
   }
   if (currentChunk.trim().length > 0) {
     chunks.push(currentChunk.trim());
   }
   return chunks.filter((c)=>c.length >= 50);
 }
 serve(async (req)=>{
   if (req.method === 'OPTIONS') {
     return new Response('ok', {
       status: 200,
       headers: corsHeaders
     });
   }
   try {
     const { rapport_id } = await req.json();
     if (!rapport_id) {
       throw new Error('rapport_id is required');
     }
     const supabaseUrl = Deno.env.get('SUPABASE_URL');
     const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
     console.log(`📋 Indexing rapport: ${rapport_id}`);
     // Récupérer le rapport
     const { data: rapport, error: rapportError } = await supabase.from('rapports').select('*, clients(id, secteur)').eq('id', rapport_id).single();
     if (rapportError) {
       console.error('Error fetching rapport:', rapportError);
       throw rapportError;
     }
     console.log(`📄 Rapport: ${rapport.titre}`);
     console.log(`  - HTML: ${rapport.contenu_html ? rapport.contenu_html.length : 0} chars`);
     console.log(`  - Résumé: ${rapport.resume ? rapport.resume.length : 0} chars`);
     let contentToIndex = '';
     let contentSource = '';
     // STRATÉGIE D'EXTRACTION (Version Simplifiée)
     // Priorité 1 : HTML (contenu complet)
     if (rapport.contenu_html && rapport.contenu_html.trim().length > 100) {
       console.log('📝 Priorité 1: Utilisation du contenu HTML...');
       contentToIndex = cleanHTML(rapport.contenu_html);
       contentSource = 'contenu_html';
       console.log(`✅ HTML nettoyé: ${contentToIndex.length} caractères`);
     } else if (rapport.resume && rapport.resume.trim().length > 100) {
       console.log('⚠️ Priorité 2: Utilisation du résumé...');
       contentToIndex = rapport.resume;
       contentSource = 'resume';
       console.log(`⚠️ Résumé: ${contentToIndex.length} caractères (contenu partiel)`);
     }
     // Aucun contenu disponible
     if (!contentToIndex) {
       console.warn('❌ Aucun contenu disponible');
       return new Response(JSON.stringify({
         success: false,
         chunks_created: 0,
         message: 'Aucun contenu disponible pour indexation',
         rapport_id: rapport_id
       }), {
         headers: {
           ...corsHeaders,
           'Content-Type': 'application/json'
         }
       });
     }
     // Enrichir avec métadonnées
     let enrichedContent = `Titre: ${rapport.titre}\n\n`;
     if (rapport.secteur) {
       enrichedContent += `Secteur: ${rapport.secteur}\n\n`;
     }
     if (rapport.mots_cles && rapport.mots_cles.length > 0) {
       enrichedContent += `Mots-clés: ${rapport.mots_cles.join(', ')}\n\n`;
     }
     enrichedContent += `Contenu:\n${contentToIndex}`;
     // Découper en chunks
     const chunks = chunkText(enrichedContent, 500);
     console.log(`✂️ Créé ${chunks.length} chunks`);
     if (chunks.length === 0) {
       return new Response(JSON.stringify({
         success: true,
         chunks_created: 0,
         message: 'Contenu trop court',
         content_source: contentSource
       }), {
         headers: {
           ...corsHeaders,
           'Content-Type': 'application/json'
         }
       });
     }
     // Créer les embeddings
     console.log('🔄 Création des embeddings...');
     const embeddings = await Promise.all(chunks.map(async (chunk, idx)=>{
       console.log(`  Embedding ${idx + 1}/${chunks.length}...`);
       return await createEmbedding(chunk);
     }));
     console.log('✅ Embeddings créés');
     // Supprimer les anciens chunks
     await supabase.from('rapport_chunks').delete().eq('rapport_id', rapport_id);
     // Insérer les nouveaux chunks
     const chunksToInsert = chunks.map((chunk, idx)=>({
         rapport_id: rapport.id,
         client_id: rapport.client_id,
         chunk_text: chunk,
         chunk_index: idx,
         embedding: embeddings[idx],
         metadata: {
           titre: rapport.titre,
           date_generation: rapport.date_generation,
           secteur: rapport.clients?.secteur || rapport.secteur || null,
           type_rapport: rapport.type_rapport,
           nb_sources: rapport.nb_sources,
           mots_cles: rapport.mots_cles || [],
           pdf_url: rapport.pdf_url,
           content_source: contentSource
         }
       }));
     const { error: insertError } = await supabase.from('rapport_chunks').insert(chunksToInsert);
     if (insertError) {
       console.error('Error inserting chunks:', insertError);
       throw insertError;
     }
     // Marquer comme indexé
     await supabase.from('rapports').update({
       indexe_rag: true,
       date_indexation: new Date().toISOString()
     }).eq('id', rapport_id);
     console.log(`🎉 Indexation terminée !`);
     console.log(`   - Chunks: ${chunks.length}`);
     console.log(`   - Source: ${contentSource}`);
     console.log(`   - Taille: ${contentToIndex.length} caractères`);
     return new Response(JSON.stringify({
       success: true,
       chunks_created: chunks.length,
       rapport_id: rapport_id,
       content_source: contentSource,
       content_length: contentToIndex.length,
       titre: rapport.titre
     }), {
       headers: {
         ...corsHeaders,
         'Content-Type': 'application/json'
       }
     });
   } catch (error) {
     console.error('❌ Error:', error);
     return new Response(JSON.stringify({
       success: false,
       error: error.message,
       stack: error.stack
     }), {
       status: 500,
       headers: {
         ...corsHeaders,
         'Content-Type': 'application/json'
       }
     });
   }
 });
 
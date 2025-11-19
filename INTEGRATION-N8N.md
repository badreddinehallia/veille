# 🔧 Guide d'intégration n8n

## Ce qui a changé

Le frontend envoie maintenant **l'état actuel de l'onboarding** depuis Supabase à chaque message. Cela permet à l'agent de savoir :
- À quelle étape on en est
- Quelles données ont déjà été collectées
- Si l'onboarding est terminé

## 📥 Données reçues par n8n

Votre webhook reçoit maintenant :

```json
{
  "message": "Tech",
  "user_id": "1895552f-eed6-4bcb-8f2d-7a2d3db37a24",
  "current_state": {
    "user_id": "1895552f-eed6-4bcb-8f2d-7a2d3db37a24",
    "config": {
      "prenom": "Badreddine",
      "email": "badreddine@hallia.ai",
      "secteur": null,
      "etape_actuelle": 2,
      "etapes_validees": [1]
    },
    "etape_actuelle": 2,
    "is_completed": false
  }
}
```

## ✏️ Modification du prompt de l'agent IA

### 1. Ajoutez au début du prompt :

```
Message utilisateur : {{ $('Webhook - Entrée Utilisateur').item.json.body.message }}

User ID : {{ $('Webhook - Entrée Utilisateur').item.json.body.user_id }}

État actuel (Supabase) : {{ $('Webhook - Entrée Utilisateur').item.json.body.current_state }}

⚠️ IMPORTANT - LOGIQUE DE PROGRESSION :

1. Vérifier si current_state existe et n'est pas null
2. Si oui, récupérer current_state.etape_actuelle (exemple: 2)
3. Si oui, récupérer current_state.config pour voir les données déjà collectées
4. Continuer depuis cette étape au lieu de recommencer à 1
5. Si current_state est null ou n'existe pas, commencer à l'étape 1

EXEMPLE :
- Si current_state.etape_actuelle = 2 ET current_state.config.prenom = "Badreddine"
  → L'utilisateur a déjà donné son prénom, on est à l'étape 2 (Secteur)
  → Demande le secteur, PAS le prénom !

- Si current_state.etape_actuelle = 5 ET current_state.config.concurrents = ["OpenAI", "Microsoft"]
  → L'utilisateur est à l'étape 5 (Profils LinkedIn)
  → Suggère automatiquement les profils LinkedIn de OpenAI et Microsoft
```

### 2. Modifiez la logique des réponses :

Au lieu de toujours commencer par :
```
"Salut ! Je vais t'aider à configurer ta veille concurrentielle. Pour commencer, donne-moi ton prénom et ton email."
```

Faites :
```javascript
// Vérifier l'état actuel
const currentState = {{ $('Webhook - Entrée Utilisateur').item.json.body.current_state }};
const etapeActuelle = currentState?.etape_actuelle || 1;
const config = currentState?.config || {};

// Si étape 1 et pas de prénom
if (etapeActuelle === 1 && !config.prenom) {
  → Demander prénom + email
}

// Si étape 2 et prénom existe
else if (etapeActuelle === 2 && config.prenom) {
  → Saluer avec le prénom et demander le secteur
  → "Parfait [prenom] ! Dans quel secteur se situe ton entreprise ?"
}

// Si étape 3 et secteur existe
else if (etapeActuelle === 3 && config.secteur) {
  → Demander les mots-clés avec suggestions adaptées au secteur
}

// etc.
```

### 3. Format de réponse (IMPORTANT) :

Votre agent doit TOUJOURS retourner :

```json
{
  "message_utilisateur": "Ton message ici",
  "suggestions": [...],
  "config": {
    "user_id": "{{ $('Webhook - Entrée Utilisateur').item.json.body.user_id }}",
    "route": "onboarding",
    "status": "next_step",
    "etape_actuelle": 3,  // ← Incrémenter après validation
    "prenom": "Badreddine",  // ← Garder les données précédentes
    "email": "test@example.com",  // ← Garder les données précédentes
    "secteur": "Tech",  // ← Nouvelle donnée collectée
    "Mots clés": [],
    "concurrents": [],
    "profiles_linkedin": [],
    "sources_veille": [],
    "frequence": null,
    "heure_envoi": null,
    "canaux_diffusion": [],
    "alertes_temps_reel": false,
    "etapes_validees": [1, 2]  // ← Ajouter l'étape validée
  }
}
```

## 🎯 Points clés

### ✅ À FAIRE :
- Utiliser `current_state.etape_actuelle` pour savoir où on en est
- Récupérer les données de `current_state.config` et les GARDER dans la réponse
- Incrémenter `etape_actuelle` après chaque validation
- Ajouter l'étape à `etapes_validees`
- Retourner `route: "completed"` et `status: "done"` à l'étape finale

### ❌ À NE PAS FAIRE :
- Ne PAS recommencer à zéro si `current_state` existe
- Ne PAS redemander des informations déjà collectées
- Ne PAS oublier de copier les données précédentes dans la config de réponse
- Ne PAS envoyer l'historique de conversation (géré par Memory node)

## 🧪 Test

1. **Première fois** (current_state = null) :
   - L'agent demande le prénom et email
   - Retourne config avec etape_actuelle = 1

2. **Deuxième message** (current_state.etape_actuelle = 2) :
   - L'agent dit "Parfait [prenom] !" et demande le secteur
   - Ne redemande PAS le prénom
   - Retourne config avec les données précédentes + secteur + etape_actuelle = 3

3. **Étape finale** (etape_actuelle = 10) :
   - L'agent affiche le récapitulatif complet
   - Retourne `route: "completed"` et `status: "done"`
   - Le frontend affiche le message avec animation
   - Puis redirige vers le dashboard après 6 secondes

## 💡 Exemple concret

**Requête reçue (étape 2) :**
```json
{
  "message": "Tech",
  "user_id": "123",
  "current_state": {
    "etape_actuelle": 2,
    "config": {
      "prenom": "Badr",
      "email": "badr@test.com"
    }
  }
}
```

**Réponse attendue :**
```json
{
  "message_utilisateur": "Parfait Badr ! 👍\n\nMaintenant, dans quel secteur se situe ton entreprise ?",
  "suggestions": [],
  "config": {
    "user_id": "123",
    "route": "onboarding",
    "status": "next_step",
    "etape_actuelle": 2,
    "prenom": "Badr",  // ← GARDÉ
    "email": "badr@test.com",  // ← GARDÉ
    "secteur": null,  // ← À collecter
    "etapes_validees": [1]
  }
}
```

Après que l'utilisateur réponde "Tech" :

```json
{
  "message_utilisateur": "Super ! Tech, c'est passionnant 🚀\n\nMaintenant, quels sont les mots-clés...",
  "suggestions": [...],
  "config": {
    "user_id": "123",
    "route": "onboarding",
    "status": "next_step",
    "etape_actuelle": 3,  // ← Incrémenté
    "prenom": "Badr",  // ← GARDÉ
    "email": "badr@test.com",  // ← GARDÉ
    "secteur": "Tech",  // ← Ajouté
    "Mots clés": [],  // ← À collecter
    "etapes_validees": [1, 2]  // ← Étape 2 ajoutée
  }
}
```

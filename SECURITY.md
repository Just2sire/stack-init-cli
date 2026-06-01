# Politique de sécurité

## Versions supportées

| Version | Support          |
|---------|------------------|
| 0.2.x   | ✓ Support actif  |
| 0.1.x   | ✗ Non supporté   |

## Signaler une vulnérabilité

**Ne pas créer d'issue GitHub publique pour des problèmes de sécurité.**

Pour signaler une vulnérabilité, envoyez un email à :

**kossidesirekomla@gmail.com**

Merci d'inclure dans votre message :

- Description de la vulnérabilité
- Étapes pour reproduire le problème
- Impact potentiel
- Suggestions de correctif (optionnel)

## Délais de réponse

| Étape | Délai |
|---|---|
| Accusé de réception | 48 heures |
| Évaluation initiale | 5 jours ouvrables |
| Correctif et publication | 7 à 14 jours selon la complexité |

## Processus

1. Vous signalez la vulnérabilité par email (jamais publiquement)
2. Nous accusons réception sous 48h
3. Nous évaluons l'impact et développons un correctif
4. Nous publions une version corrective sur npm
5. Vous êtes crédité dans le CHANGELOG (si souhaité)

## Périmètre

Ce projet est un CLI Node.js de génération de code. Les vulnérabilités pertinentes incluent :

- Injection de contenu malveillant dans les fichiers générés (templates Handlebars)
- Path traversal lors de l'écriture des fichiers générés
- Exécution de code arbitraire via un `stack-init.yaml` malformé
- Dépendances npm avec des vulnérabilités connues (CVE)

Merci de contribuer à la sécurité du projet.

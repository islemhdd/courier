# Rapport de securite globale de l'application de gestion de courrier

## 1. Introduction

Ce rapport presente l'analyse de securite de l'application de gestion de courrier developpee dans le cadre du stage. L'objectif est d'evaluer les mecanismes de protection mis en place, d'expliquer leur role dans l'application et d'identifier les points qui doivent etre renforces avant une mise en production.

L'application manipule des donnees sensibles : courriers administratifs, pieces jointes, utilisateurs, roles, messages internes, archives, notifications et textes extraits par OCR. La securite est donc un aspect central du projet, car elle doit garantir la confidentialite des documents, l'integrite des traitements et la disponibilite du service.

L'analyse a ete realisee sur le code source local de l'application, le 12 mai 2026. Elle couvre principalement le backend Laravel, l'API, l'authentification, les autorisations, la gestion des fichiers, les messages, les courriers, les archives, les notifications, l'OCR et les dependances.

## 2. Presentation technique de l'application

L'application repose sur une architecture web moderne composee de deux parties principales :

- Backend : Laravel 12, PHP 8.2+, Laravel Sanctum, sessions Laravel, queues/jobs, notifications, Reverb pour les communications temps reel et Eloquent ORM pour l'acces aux donnees.
- Frontend : React avec Vite, interface SPA, appels API authentifies, gestion des pages courriers, messages, utilisateurs, archives, validation et administration.
- Base de donnees : migrations Laravel pour les utilisateurs, services, structures, courriers, pieces jointes, messages, archives, niveaux de confidentialite, notifications et donnees OCR.
- Traitements asynchrones : job `ProcessOcrJob` pour l'extraction de texte et la generation de resume automatique.

Cette architecture separe les responsabilites : le frontend affiche les donnees et declenche les actions, tandis que le backend applique les regles de securite et de gestion metier.

## 3. Objectifs de securite

Les principaux objectifs de securite de l'application sont les suivants :

- Confidentialite : empecher un utilisateur non autorise de consulter un courrier, une archive, un message ou une piece jointe.
- Integrite : eviter la modification, la suppression, la validation ou la transmission non autorisee d'un courrier.
- Authentification : verifier l'identite de l'utilisateur avant tout acces aux fonctionnalites internes.
- Autorisation : appliquer des droits differents selon le role, le perimetre organisationnel et le niveau de confidentialite.
- Tracabilite : journaliser les actions sensibles comme la creation, la modification ou la suppression d'utilisateurs.
- Disponibilite : limiter les abus par le rate limiting et organiser les traitements lourds, comme l'OCR, en taches asynchrones.

## 4. Authentification et gestion des sessions

L'application utilise Laravel Sanctum et le systeme de sessions Laravel pour authentifier les utilisateurs. La route API de connexion `/api/login` est protegee par une limitation de tentatives avec `throttle:5,1`, ce qui reduit le risque d'attaque par force brute.

Lors de la connexion, la classe `LoginRequest` verifie l'adresse email, le mot de passe et l'etat actif du compte. Un compte desactive ne peut donc pas s'authentifier. Apres une authentification reussie, la session est regeneree afin de limiter les risques de fixation de session.

Les mots de passe sont haches avec les mecanismes standards de Laravel. Dans la gestion des utilisateurs, les mots de passe sont traites avec `Hash::make`, et le modele `User` protege egalement le champ `password` en le masquant dans les reponses JSON.

Mesures observees :

- Authentification obligatoire sur les routes API internes via `auth:sanctum`.
- Regeneration de session apres connexion.
- Invalidation de session et regeneration du token CSRF a la deconnexion.
- Verrouillage progressif des tentatives de connexion avec `RateLimiter`.
- Prise en compte de l'attribut `actif` pour empecher l'acces aux comptes desactives.

## 5. Controle d'acces par roles et perimetres

Le controle d'acces est l'un des points les plus importants de l'application. Il repose sur trois roles principaux :

- `admin` : role disposant des droits les plus eleves, notamment pour l'administration et la suppression.
- `chef` : role hierarchique pouvant valider, transmettre ou gerer des donnees selon son perimetre.
- `secretaire` : role operationnel, limite a la saisie, consultation ou transmission selon le contexte.

Ces roles sont completes par un perimetre appele `role_scope` :

- `general` : perimetre global.
- `structure` : perimetre limite a une structure.
- `service` : perimetre limite a un service.

Cette combinaison role + perimetre permet d'eviter qu'un utilisateur ayant une responsabilite locale obtienne automatiquement des droits globaux. Par exemple, un chef de service ne doit pas pouvoir gerer les utilisateurs d'un autre service, et un chef de structure ne doit pas creer un chef general.

Les autorisations sont appliquees a plusieurs niveaux :

- Dans les policies Laravel : `UserPolicy`, `CourrierPolicy`, `MessagePolicy`, `ServicePolicy`.
- Dans les modeles metier : `User`, `Courrier`, `Archive`.
- Dans les controleurs : verification avant consultation, suppression, validation, transmission ou telechargement.
- Dans les FormRequest : validation des donnees et verification de certaines contraintes metier.

Les tests de securite confirment que les escalades de privileges principales sont bloquees. Par exemple, un chef de structure ne peut pas creer un chef general, un chef de service ne peut pas creer un utilisateur hors de son service et un secretaire simple ne peut pas gerer les utilisateurs.

## 6. Securite des courriers

Les courriers constituent le coeur fonctionnel de l'application. Leur securite est traitee par plusieurs mecanismes.

### 6.1. Consultation controlee

La consultation d'un courrier depend du role, du service, de la structure, des destinataires et du niveau de confidentialite. Le modele `Courrier` centralise cette logique avec des methodes telles que :

- `visiblePourUser`
- `peutVoirExistencePar`
- `peutEtreConsultePar`
- `peutEtreVuEnDetailPar`
- `niveauEstAutorisePour`

Cette separation permet de distinguer deux niveaux d'acces :

- Voir l'existence d'un courrier : l'utilisateur peut savoir qu'un courrier existe dans son perimetre.
- Voir le detail du courrier : l'utilisateur peut consulter le contenu complet uniquement si son niveau de confidentialite le permet.

Cette approche est importante, car certains utilisateurs peuvent avoir besoin de voir qu'un courrier existe sans pour autant avoir le droit de consulter son contenu detaille.

### 6.2. Confidentialite par niveau

Chaque courrier est associe a un niveau de confidentialite. Le systeme compare le rang du courrier avec le rang de confidentialite de l'utilisateur. Si le niveau du courrier est superieur au niveau de l'utilisateur, l'acces detaille est refuse.

Cette regle permet d'eviter qu'un utilisateur ayant un role organisationnel correct, mais un niveau de confidentialite insuffisant, puisse consulter un document sensible.

### 6.3. Creation, validation et transmission

La creation des courriers est encadree par `StoreCourrierRequest`. Cette classe verifie notamment :

- le type du courrier ;
- la presence des champs obligatoires ;
- le niveau de confidentialite choisi ;
- les destinataires ;
- le mode de diffusion ;
- les pieces jointes ;
- les contraintes propres aux courriers entrants et sortants.

La validation et la transmission sont protegees par des methodes metier comme `peutEtreValidePar` et `peutEtreTransmisPar`. Les secretaires peuvent initier certaines actions, mais celles-ci peuvent necessiter une validation par un chef selon le statut du courrier.

### 6.4. Reponse aux courriers

Les reponses aux courriers sont protegees par la methode `peutEtreReponduPar`. Lorsqu'une reponse est creee, l'application verifie que le courrier parent existe et que l'utilisateur a bien le droit d'y repondre.

Le niveau de confidentialite de la reponse est force a partir du courrier parent. Cette mesure evite qu'une reponse a un courrier confidentiel soit creee avec un niveau de confidentialite plus faible, ce qui pourrait provoquer une fuite d'information.

## 7. Securite des fichiers et pieces jointes

Les pieces jointes representent un risque important, car elles peuvent contenir des documents confidentiels ou des fichiers malveillants. L'application applique plusieurs protections :

- Validation des extensions autorisees : PDF, DOC, DOCX, JPG, JPEG, PNG, WEBP.
- Validation des types MIME.
- Limitation de taille a 10 Mo par fichier.
- Limitation du nombre de documents a 5.
- Nettoyage du nom original du fichier avec une expression reguliere.
- Stockage avec un nom unique pour eviter les collisions.
- Stockage sur le disque `local`, rattache a `storage/app/private`, au lieu d'un stockage public.

Le telechargement des fichiers passe par des methodes controlees du `CourrierController` :

- `downloadCourrierFile`
- `downloadAttachment`

Avant de retourner le fichier, ces methodes verifient que l'utilisateur a le droit de consulter le courrier avec `peutEtreConsultePar`. Cela evite qu'une piece jointe soit accessible directement par une URL publique sans controle d'acces.

Point d'attention : le frontend contient encore des constructions d'URL vers `/storage/...` dans certains composants. Comme les fichiers sont maintenant stockes en prive, cette logique doit etre alignee avec les routes de telechargement securisees pour eviter toute confusion fonctionnelle.

## 8. Securite des messages internes

Le module de messagerie permet aux utilisateurs d'echanger des messages et de rattacher eventuellement un courrier. Les controles observes sont les suivants :

- Un utilisateur ne peut voir que les messages dont il est emetteur ou destinataire.
- Les brouillons ne sont visibles que par leur emetteur.
- Un utilisateur ne peut pas s'envoyer un message a lui-meme.
- Un message envoye ne peut plus etre modifie comme un brouillon.
- Le rattachement d'un courrier a un message est controle : l'emetteur et le destinataire doivent avoir le droit de consulter le courrier reference.

Ce dernier point est important : il empeche un utilisateur de transmettre indirectement la reference d'un courrier confidentiel a une personne qui n'a pas le droit de le consulter.

## 9. Securite des archives

Les archives disposent de leur propre modele de controle d'acces. Le modele `Archive` verifie si l'utilisateur peut voir l'existence ou le detail d'une archive selon son role, son service et son niveau de confidentialite.

La suppression d'une archive est reservee a l'administrateur. Cette restriction protege l'historique et limite les risques de destruction non autorisee de documents.

Les archives conservent egalement des informations de contexte, comme les pieces jointes et les commentaires sous forme de snapshots. Cela permet de garder une trace du courrier au moment de son archivage.

## 10. Validation des donnees et protection contre les injections

L'application utilise largement les `FormRequest` Laravel pour valider les entrees. Cela permet de centraliser les contraintes et de reduire les erreurs dans les controleurs.

Les validations couvrent notamment :

- types de donnees ;
- longueurs maximales ;
- presence obligatoire ;
- existence des identifiants en base ;
- unicite des emails et libelles ;
- valeurs autorisees pour les statuts, roles, scopes et modes de diffusion ;
- niveau de confidentialite autorise ;
- coherence des destinataires.

Concernant les injections SQL, l'application utilise Eloquent ORM et le Query Builder Laravel. Ces outils utilisent des requetes preparees, ce qui reduit fortement le risque d'injection SQL lorsque les requetes sont construites avec les methodes standards.

Pour les champs de recherche, l'application utilise des clauses `where`, `whereHas`, `whereRaw` avec parametres lies et des filtres structures. Les recherches plein texte sont donc mieux maitrisees que des concatenations SQL directes.

## 11. Protection CSRF, CORS et API

L'application utilise Sanctum pour les appels API authentifies depuis le frontend. Les routes sensibles sont placees dans un groupe protege par `auth:sanctum`.

La configuration CORS autorise les origines de developpement connues, comme `localhost:5173`, `127.0.0.1:5173` et `localhost:8000`. Les credentials sont actives, ce qui est necessaire pour une SPA utilisant des cookies de session, mais impose de limiter strictement les origines en production.

En production, il faudra definir explicitement `CORS_ALLOWED_ORIGINS` avec uniquement les domaines officiels de l'application. Il ne faut pas conserver une configuration de developpement trop large.

## 12. Rate limiting et protection contre les abus

Plusieurs routes API sont protegees par un rate limiting :

- Connexion : `throttle:5,1`.
- Liste des courriers : `throttle:60,1`.
- Creation et modification des courriers : `throttle:30,1`.
- Messages : creation limitee avec `throttle:10,1`.
- Recherche de destinataires : `throttle:30,1`.
- Gestion des utilisateurs : creation et suppression limitees.
- Demande de validation : `throttle:10,1`.

Ce mecanisme reduit les risques de force brute, de spam, de surcharge volontaire et d'abus fonctionnel.

## 13. Journalisation et tracabilite

Certaines actions sensibles sont journalisees, notamment :

- creation d'utilisateur ;
- modification d'utilisateur ;
- suppression d'utilisateur.

Les logs contiennent l'identifiant de l'acteur, l'identifiant de la cible, l'email de la cible, les changements effectues et l'adresse IP. Cette tracabilite est utile pour les audits internes et pour comprendre l'origine d'un incident.

Point a renforcer : la meme logique de journalisation devrait etre etendue aux actions sensibles sur les courriers, comme validation, non-validation, transmission, suppression, archivage, telechargement de piece jointe et relance OCR.

## 14. Securite de l'OCR

Le module OCR extrait le texte des fichiers PDF, Word et images. Il utilise `smalot/pdfparser`, Tesseract et eventuellement Ghostscript ou Imagick pour convertir certains documents.

Mesures positives :

- seuls certains types de fichiers sont acceptes ;
- la taille des fichiers est limitee ;
- les erreurs OCR sont capturees et journalisees ;
- l'extraction est executee dans un job asynchrone.

Points de vigilance :

- les outils externes appeles par `exec` doivent etre maintenus a jour ;
- les fichiers traites par OCR doivent rester dans le stockage prive ;
- le service OCR doit lire les fichiers depuis le meme disque que celui utilise pour les stocker ;
- il faut eviter d'exposer dans les erreurs des chemins systeme ou des details internes.

## 15. Securite des notifications temps reel

Les notifications sont associees aux utilisateurs authentifies. Les routes de broadcast utilisent `auth:sanctum`, et le canal `App.Models.User.{id}` verifie que l'utilisateur connecte correspond bien a l'identifiant du canal.

Cette configuration limite le risque qu'un utilisateur ecoute les notifications d'un autre compte.

Recommandation : les notifications ne doivent contenir que les informations necessaires a l'affichage. Les donnees sensibles, comme le contenu complet d'un courrier ou d'une piece jointe, doivent rester consultees via les routes API controlees.

## 16. Audit des dependances

Des controles de dependances ont ete executes :

- `composer audit --format=plain` : aucune vulnerability advisory detectee.
- `npm.cmd audit --omit=dev` a la racine : 0 vulnerabilite.
- `npm.cmd audit --omit=dev` dans `resources/js/mon-projet` : 0 vulnerabilite.

Ces resultats sont positifs, mais ils ne remplacent pas une veille continue. Les dependances PHP et JavaScript doivent etre reauditees regulierement, surtout avant une mise en production.

## 17. Tests de securite executes

La suite ciblee `tests/Feature/SecurityTest.php` a ete executee avec succes :

- 14 tests passes ;
- 14 assertions reussies ;
- aucun echec sur cette suite.

Les scenarios couverts incluent :

- prevention de l'escalade de privileges ;
- interdiction pour un secretaire simple de gerer les utilisateurs ;
- protection contre l'acces non autorise aux courriers ;
- protection IDOR par retour 404 sur les courriers non accessibles ;
- rejet des fichiers invalides ;
- rejet des fichiers trop volumineux ;
- suppression de courrier reservee a l'administrateur ;
- interdiction de creer un courrier avec un niveau de confidentialite superieur a celui de l'utilisateur ;
- limitation des tentatives de connexion ;
- interdiction de s'envoyer un message a soi-meme.

Ces tests confirment que plusieurs controles essentiels sont deja automatises.

## 18. Risques residuels identifies

### Risque 1 : fichier `.env` suivi par Git

Le fichier `.env` est suivi par Git. C'est un risque critique, car ce fichier peut contenir des secrets : cle d'application, identifiants de base de donnees, configuration mail, cles de services externes et parametres de production.

De plus, le fichier local indique :

- `APP_ENV=local`
- `APP_DEBUG=true`
- `SESSION_ENCRYPT=false`

Ces valeurs sont acceptables en developpement local, mais dangereuses en production.

Correction recommandee :

- ajouter `.env` dans `.gitignore` ;
- retirer `.env` du suivi Git avec `git rm --cached .env` ;
- conserver uniquement `.env.example` dans le depot ;
- changer les secrets si le fichier a deja ete partage ;
- utiliser `APP_ENV=production` et `APP_DEBUG=false` en production ;
- activer `SESSION_ENCRYPT=true` en production.

### Risque 2 : inscription web publique encore active

Les routes web `GET /register` et `POST /register` sont encore exposees. Le controleur `RegisteredUserController` cree un utilisateur actif par defaut. Les migrations donnent au nouvel utilisateur le role par defaut `secretaire` et le perimetre `service`.

Si l'application est destinee a fonctionner uniquement avec des comptes crees par l'administrateur, cette inscription publique doit etre desactivee.

Correction recommandee :

- supprimer ou desactiver les routes `register` ;
- imposer la creation de compte par l'administrateur ;
- si l'inscription publique est necessaire, creer les comptes avec `actif=false` et imposer une validation administrative.

### Risque 3 : route de test en production

La route `/api/test-notification` existe dans le groupe authentifie. Elle semble destinee au developpement. Meme si elle ne donne pas directement acces a des donnees sensibles, elle ne doit pas rester disponible en production.

Correction recommandee :

- supprimer la route ;
- ou la proteger par une condition d'environnement local ;
- ou la reserver aux administrateurs.

### Risque 4 : configuration CORS de developpement

La configuration CORS autorise plusieurs origines locales. Cela est normal en developpement, mais doit etre strictement remplace par les domaines officiels en production.

Correction recommandee :

- definir `CORS_ALLOWED_ORIGINS` en production ;
- interdire les origines non utilisees ;
- verifier que `supports_credentials=true` n'est utilise qu'avec des domaines fiables.

### Risque 5 : duree longue des tokens Sanctum

La configuration Sanctum definit une expiration longue de 525600 minutes, soit environ un an, pour les tokens API. Pour une SPA utilisant principalement les cookies de session, ce parametre concerne surtout les tokens personnels, mais il reste important.

Correction recommandee :

- reduire la duree de vie des tokens si des tokens personnels sont utilises ;
- appliquer une rotation ou revocation des tokens ;
- journaliser les creations et suppressions de tokens.

### Risque 6 : OCR et outils systeme externes

L'OCR repose sur des outils externes comme Tesseract et Ghostscript. Ces composants peuvent presenter des vulnerabilites s'ils ne sont pas maintenus a jour.

Correction recommandee :

- maintenir Tesseract, Ghostscript et Imagick a jour ;
- executer l'OCR dans un environnement limite ;
- imposer des limites de temps et de memoire ;
- eviter de retourner a l'utilisateur des messages d'erreur techniques trop detailles.

## 19. Plan d'amelioration prioritaire

Priorite critique :

1. Retirer `.env` du depot Git et changer les secrets exposes.
2. Desactiver l'inscription publique si les comptes doivent etre crees par l'administrateur.
3. Configurer l'environnement de production avec `APP_DEBUG=false`, `APP_ENV=production`, `SESSION_ENCRYPT=true` et cookies securises.

Priorite haute :

1. Supprimer ou proteger `/api/test-notification`.
2. Restreindre strictement les origines CORS de production.
3. Aligner le frontend sur les routes de telechargement securisees au lieu de construire des URLs `/storage/...`.
4. Verifier que l'OCR lit les fichiers depuis le stockage prive.

Priorite moyenne :

1. Ajouter une journalisation plus complete sur les actions de courriers.
2. Ajouter des tests sur l'inscription publique, les routes de test, les telechargements et les archives.
3. Mettre en place une politique de sauvegarde et restauration de la base de donnees.
4. Planifier un audit regulier des dependances.

## 20. Evaluation globale

L'application dispose d'une base de securite solide pour un projet de gestion de courrier :

- authentification controlee ;
- roles et perimetres bien definis ;
- verification des droits au niveau des modeles ;
- controle du niveau de confidentialite ;
- fichiers stockes en prive ;
- validations metier avancees ;
- rate limiting ;
- tests de securite automatises ;
- absence de vulnerabilites connues dans les dependances auditees.

Cependant, certains points doivent etre corriges avant toute mise en production, principalement la presence du fichier `.env` dans Git, l'inscription publique, la configuration de production et la suppression des routes de test.

## 21. Conclusion

La securite de cette application repose sur une approche multi-niveaux : authentification, autorisation, validation des donnees, confidentialite des courriers, stockage prive des fichiers, controle des messages et tests automatises. Cette approche est adaptee a une application administrative, car elle tient compte de la hierarchie de l'organisation et de la sensibilite des documents.

Les controles implementes montrent que l'application ne se limite pas a verifier si un utilisateur est connecte. Elle verifie aussi ce qu'il a le droit de faire, dans quel service ou structure il se trouve, et quel niveau de confidentialite il possede. C'est un point fort important.

Avant le deploiement, les corrections prioritaires doivent etre appliquees afin d'eviter l'exposition des secrets, la creation non controlee de comptes et l'utilisation de configurations de developpement en environnement reel. Une fois ces corrections effectuees, l'application pourra disposer d'un niveau de securite plus coherent avec les exigences d'un systeme de gestion documentaire interne.

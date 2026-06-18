-- Migration 008 — NO-OP sous MySQL.
--
-- Sous PostgreSQL, vendors héritait de users et n'héritait PAS de la clé primaire, d'où
-- cette migration qui l'ajoutait (requis par AdminJS @adminjs/sql). Sous MySQL il n'y a
-- pas d'héritage : vendors possède déjà sa PRIMARY KEY (id) dès sa création (002). Cette
-- étape est donc sans effet ; on la conserve pour garder la même séquence de migrations.
SELECT 1;

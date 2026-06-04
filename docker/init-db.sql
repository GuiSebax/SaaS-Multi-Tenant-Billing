-- Role de aplicação sem superuser, sem BYPASSRLS.
-- Conecta-se ao banco; todas as queries passam pelo RLS.
CREATE ROLE app_user WITH LOGIN PASSWORD 'dev_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

-- app_user é dono do banco para poder alterar objetos que ele cria.
ALTER DATABASE saas_dev OWNER TO app_user;

-- Acesso total ao schema public (inclui CREATE TABLE para migrations).
GRANT ALL ON SCHEMA public TO app_user;

-- Objetos existentes (geralmente nenhum neste ponto, mas por segurança).
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Objetos futuros criados por postgres (ex: tabelas de setup em testes).
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO app_user;

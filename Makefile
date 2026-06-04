.PHONY: up down logs psql

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

psql:
	docker compose exec postgres psql -U postgres -d saas_dev

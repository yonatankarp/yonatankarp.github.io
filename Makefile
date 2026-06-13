.PHONY: serve build clean

## Development
serve: ## Start dev server
	hugo server || .tools/hugo/hugo server

## Production
build: ## Production build
	hugo --gc --minify || .tools/hugo/hugo --gc --minify

## Cleanup
clean: ## Remove build artifacts
	rm -rf public/ resources/ .hugo_build.lock hugo_stats.json

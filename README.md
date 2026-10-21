# MID Store · PWA

Nova versão do catálogo MID Store, com tema escuro e detalhes rosa.

## Importação do catálogo antigo

Os **20 produtos** que tinham nome, preço e descrição no CAPX foram importados para `products.json`. Foram recuperadas **77 fotos** (convertidas para WebP), preservadas em `images/products/`. As seis categorias originais são Cozinha, Decoração, Beleza, Banheiro, Acessórios e Brinquedos. Algumas associações de categorias foram inferidas pelo nome, portanto revise-as no painel administrativo.

## Publicar catálogo

1. Crie um repositório **MID-Store** no GitHub e envie todo o conteúdo desta pasta para a raiz do repositório.
2. Ative **Settings → Pages → Deploy from a branch → main → /(root)**.
3. Acesse a URL da página, terminando normalmente em `/MID-Store/`. O catálogo público já abrirá e permitirá consultar produtos.
4. No painel, configure seu WhatsApp com **DDI + DDD + número**, sem símbolos (ex.: `5511999999999`). Antes disso, o botão de contato avisa que falta configurar.

## Ativar o painel administrativo online

O GitHub Pages é uma hospedagem **estática**. Ele não consegue salvar arquivos por conta própria. Para que o painel funcione no próprio catálogo, use o código `backend/worker.js` em um **Cloudflare Worker**, protegido por autenticação. Nunca coloque token de acesso do GitHub no código público.

1. Crie um Worker no Cloudflare e substitua o conteúdo do Worker por `backend/worker.js`.
2. Nas configurações do Worker, defina as **variáveis**: `GITHUB_OWNER` (seu usuário GitHub), `GITHUB_REPO` (`MID-Store`), `GITHUB_BRANCH` (`main`) e `ALLOWED_ORIGIN` (origem **exata** da página, p.ex. `https://usuario.github.io`, sem barra final).
3. Defina **segredos** do Worker: `ADMIN_PASSWORD` (senha forte), `SESSION_SECRET` (texto aleatório longo e secreto) e `GITHUB_TOKEN` (token fine-grained restrito ao repositório, com permissão `Contents: Read and write`).
4. Faça deploy do Worker. Copie a URL HTTPS completa do Worker (por exemplo `https://mid-store-api.exemplo.workers.dev`) e coloque-a em `config.js` no campo `apiUrl`.
5. Publique novamente o `config.js`, aguarde a atualização e entre em `#/admin`.

**Notas:** As alterações feitas pelo painel são commits no repositório e podem demorar a aparecer após o deploy. As imagens removidas dos produtos não são excluídas automaticamente do GitHub. As imagens adicionadas são limitadas a 4 MB cada no formulário e oito imagens por envio no Worker. O Worker exige origem exata e autentica a sessão com assinatura HMAC. Para uma operação comercial de maior porte, adicione rate limiting ao login, upload e observabilidade.

## Testar localmente

Use um servidor HTTP local, não abra `index.html` por `file://`. Na pasta do projeto, execute `python -m http.server 8080` e abra `http://localhost:8080` no navegador. O PWA só é instalável em HTTPS ou localhost.

O Worker é um exemplo de integração seguro para uma loja pequena; recomenda-se testar em repositório separado antes de ativar a produção.

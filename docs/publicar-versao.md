# Publicar uma versão nova

Para o Renato. Os PCs com o app instalado procuram atualização ao abrir e a cada 4 horas, baixam sozinhos e mostram "Reiniciar para atualizar".

## Uma vez só

1. O repositório `rrenatotc/esteiraRepasse` precisa estar **público** (GitHub → Settings → General → Change visibility). O app instalado baixa as atualizações de lá sem login.
2. Crie um token no GitHub: Settings → Developer settings → Personal access tokens → **Fine-grained token**, com acesso só ao repositório `esteiraRepasse` e permissão **Contents: Read and write**.
3. Guarde o token como variável de ambiente do seu usuário no Windows, no PowerShell:

   ```powershell
   [Environment]::SetEnvironmentVariable('GH_TOKEN', 'COLE_O_TOKEN_AQUI', 'User')
   ```

   Feche e abra o terminal depois disso. Nunca coloque o token em arquivo do projeto.
4. Confira que o arquivo `.env` (URL e chave anon do Supabase) existe na pasta do projeto: ele vai embutido no instalador.

## A cada versão

1. Suba o número da versão em `package.json` (SemVer): correção `1.0.0 → 1.0.1`, novidade `1.0.1 → 1.1.0`.
2. Acrescente as novidades no topo de `src/shared/novidades.ts` (aparecem para o usuário depois de atualizar).
3. Faça commit das mudanças.
4. No terminal, na pasta do projeto:

   ```powershell
   npm run release
   ```

   Ele roda os testes, gera o instalador `dist/EsteiraRepasse-Setup-x.y.z.exe` e publica um Release no GitHub com o instalador e o `latest.yml` (o arquivo que o app consulta).

## Conferir

- Em https://github.com/rrenatotc/esteiraRepasse/releases deve aparecer a versão nova com o `.exe` e o `latest.yml`.
- Num PC com a versão anterior: Ajustes → **Procurar atualização**. Em poucos segundos aparece a faixa "Reiniciar para atualizar"; ao reiniciar, o app abre na versão nova e mostra as novidades.
- Logs de cada PC ficam em `%APPDATA%\esteira-repasse\logs\main.log`.

## Gerar o instalador sem publicar

```powershell
npm run build:win
```

## Publicar pela página do GitHub (sem token)

Se o `npm run release` não estiver disponível, dá para publicar à mão:

1. Gere os arquivos (se o app estiver aberto a partir de `dist`, use outra pasta de saída):

   ```powershell
   npm run build
   npx electron-builder --win --publish never --config.directories.output=dist-release
   ```

2. Em https://github.com/rrenatotc/esteiraRepasse/releases/new:
   - **Choose a tag:** digite `v1.0.0` (com o número da versão) e clique em "Create new tag".
   - **Release title:** `1.0.0`.
   - Arraste para a área de anexos os **três** arquivos de `dist-release`:
     `EsteiraRepasse-Setup-x.y.z.exe`, `EsteiraRepasse-Setup-x.y.z.exe.blockmap` e `latest.yml`.
   - Deixe marcado **Set as the latest release** e clique em **Publish release**.

Sem o `latest.yml` o app instalado não enxerga a versão nova.

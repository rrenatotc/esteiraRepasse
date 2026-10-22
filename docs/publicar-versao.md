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

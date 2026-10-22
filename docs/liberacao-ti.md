# Liberação de rede para a Esteira do Repasse

Texto para enviar à TI do Grupo Carburgo.

---

Olá, equipe de TI.

O setor de Repasse passou a usar um aplicativo interno para Windows, o **Esteira do Repasse**, instalado nos PCs do repasse e dos vendedores das lojas. Ele não precisa de servidor na nossa rede: cada PC fala direto com serviços na nuvem, sempre por **HTTPS na porta 443**.

Se houver firewall ou proxy filtrando a saída, por favor liberem:

| Endereço | Para quê | Protocolo |
|---|---|---|
| `futyhhpmvueyasheoclf.supabase.co` | banco de dados, login e consulta por placa | HTTPS e WebSocket seguro (WSS), porta 443 |
| `github.com` | verificar se há versão nova do app | HTTPS, porta 443 |
| `objects.githubusercontent.com` e `release-assets.githubusercontent.com` | baixar a versão nova (atualização automática) | HTTPS, porta 443 |

Observações:

- O **WebSocket (WSS)** para o endereço do Supabase é necessário: é por ele que as vendas novas chegam na hora no PC do repasse. Se o proxy bloquear ou encerrar conexões WebSocket longas, as notificações atrasam.
- Se o proxy faz inspeção SSL, o app precisa confiar no certificado do proxy (o mesmo que os navegadores já usam).
- A instalação é por usuário (`%LOCALAPPDATA%\Programs\esteira-repasse`), sem precisar de administrador, e as atualizações são baixadas e aplicadas pelo próprio app.
- O app ainda não tem assinatura de código; o Windows SmartScreen mostra um aviso na primeira instalação. Se a política da empresa bloquear executáveis não assinados, avisem que providenciamos um certificado.

Qualquer dúvida, falar com o Renato (Repasse).

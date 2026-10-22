import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { documentoValido, formatarDocumento, normalizarDocumento, tipoDocumento } from '@shared/documento'
import { Button } from '@renderer/components/ui/button'
import { Campo, Input } from '@renderer/components/ui/campo'
import { mensagemErro } from '@renderer/lib/erros'
import { buscarLojista, consultarCnpj, type Lojista, type LojistaNovo } from './api'
import { Confirmacao, Mensagem, Rodape } from './componentes'

export interface DadosLojista {
  documento: string
  lojista: Lojista | null
  novo: LojistaNovo | null
}

type Formulario = Pick<LojistaNovo, 'razao_social' | 'nome_fantasia' | 'cidade' | 'uf' | 'telefone' | 'email' | 'situacao_cadastral' | 'origem'>

const VAZIO: Formulario = {
  razao_social: '',
  nome_fantasia: null,
  cidade: null,
  uf: null,
  telefone: null,
  email: null,
  situacao_cadastral: null,
  origem: 'manual'
}

export function PassoLojista({
  inicial,
  onVoltar,
  onAvancar
}: {
  inicial: DadosLojista
  onVoltar: () => void
  onAvancar: (d: DadosLojista) => void
}): React.JSX.Element {
  const [documento, setDocumento] = useState(inicial.documento)
  const [form, setForm] = useState<Formulario>(inicial.novo ?? VAZIO)
  const doc = normalizarDocumento(documento)
  const tipo = tipoDocumento(doc)
  const valido = documentoValido(doc)

  const existente = useQuery({ queryKey: ['venda', 'lojista', doc], queryFn: () => buscarLojista(doc), enabled: valido })
  const cnpj = useQuery({
    queryKey: ['venda', 'cnpj', doc],
    queryFn: () => consultarCnpj(doc),
    enabled: valido && tipo === 'cnpj' && existente.data === null,
    staleTime: Infinity,
    retry: false
  })

  // Documento trocado: descarta o que foi preenchido para o anterior.
  useEffect(() => {
    if (doc !== inicial.documento) setForm(VAZIO)
  }, [doc, inicial.documento])

  // Pré-preenche com o que a BrasilAPI/OpenCNPJ devolveu.
  useEffect(() => {
    if (cnpj.data?.ok) {
      const { documento: _d, ...dados } = cnpj.data.dados
      setForm(dados)
    }
  }, [cnpj.data])

  const lojista = valido ? existente.data : undefined
  const precisaFormulario = valido && lojista === null && (tipo === 'cpf' || !cnpj.isPending)
  const podeAvancar = !!lojista || (precisaFormulario && form.razao_social.trim() !== '' && (!form.uf || /^[A-Za-z]{2}$/.test(form.uf)))

  const set = <K extends keyof Formulario>(k: K, v: string): void => setForm({ ...form, [k]: v === '' && k !== 'razao_social' ? null : v })

  function avancar(e: FormEvent): void {
    e.preventDefault()
    if (!podeAvancar || !tipo) return
    onAvancar({
      documento: doc,
      lojista: lojista ?? null,
      novo: lojista ? null : { ...form, tipo, documento: doc, razao_social: form.razao_social.trim() }
    })
  }

  const erroDocumento =
    tipo && !valido
      ? `${tipo === 'cpf' ? 'CPF' : 'CNPJ'} inválido. Confira os dígitos.`
      : doc.length > 0 && !tipo && doc.length >= 11
        ? 'Digite um CPF (11 dígitos) ou CNPJ (14 caracteres).'
        : undefined

  return (
    <form onSubmit={avancar} noValidate>
      <h2 className="mb-1 text-[17px] font-semibold">Quem está comprando?</h2>
      <p className="mb-6 text-grafite">CPF ou CNPJ do lojista. CNPJ novo é consultado na Receita automaticamente.</p>

      <div className="w-[340px]">
        <Campo rotulo="CPF ou CNPJ" erro={erroDocumento}>
          {(p) => (
            <Input
              {...p}
              autoFocus
              className="numeros h-11 text-[17px] tracking-wide"
              value={valido ? formatarDocumento(doc) : documento.toUpperCase()}
              onChange={(e) => setDocumento(e.target.value)}
              maxLength={18}
              placeholder="00.000.000/0000-00"
            />
          )}
        </Campo>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {existente.isError && <Mensagem tom="erro">{mensagemErro(existente.error)}</Mensagem>}
        {valido && existente.isPending && <p className="text-grafite">Procurando no cadastro…</p>}
        {lojista && (
          <Confirmacao titulo={lojista.razao_social}>
            {[formatarDocumento(lojista.documento), lojista.nome_fantasia, lojista.cidade && `${lojista.cidade}${lojista.uf ? `/${lojista.uf}` : ''}`]
              .filter(Boolean)
              .join(' · ')}
          </Confirmacao>
        )}
        {valido && lojista === null && tipo === 'cnpj' && cnpj.isPending && <p className="text-grafite">Consultando o CNPJ na Receita…</p>}

        {precisaFormulario && (
          <div className="animate-surgir flex flex-col gap-4">
            {tipo === 'cnpj' && cnpj.data?.ok && (
              <Mensagem tom="info">Dados encontrados na Receita. Confira antes de seguir.</Mensagem>
            )}
            {tipo === 'cnpj' && cnpj.data && !cnpj.data.ok && <Mensagem tom="alerta">{cnpj.data.mensagem}</Mensagem>}
            {form.situacao_cadastral && form.situacao_cadastral.toUpperCase() !== 'ATIVA' && (
              <Mensagem tom="alerta">Situação na Receita: {form.situacao_cadastral}. Confirme com o repasse antes de vender.</Mensagem>
            )}
            {tipo === 'cpf' && <Mensagem tom="info">CPF válido e ainda não cadastrado. Digite o nome do comprador.</Mensagem>}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Campo rotulo={tipo === 'cpf' ? 'Nome completo' : 'Razão social'}>
                  {(p) => <Input {...p} value={form.razao_social} onChange={(e) => set('razao_social', e.target.value)} />}
                </Campo>
              </div>
              {tipo === 'cnpj' && (
                <Campo rotulo="Nome fantasia">
                  {(p) => <Input {...p} value={form.nome_fantasia ?? ''} onChange={(e) => set('nome_fantasia', e.target.value)} />}
                </Campo>
              )}
              <Campo rotulo="Telefone">
                {(p) => <Input {...p} value={form.telefone ?? ''} onChange={(e) => set('telefone', e.target.value)} />}
              </Campo>
              <div className="grid grid-cols-[1fr_72px] gap-4">
                <Campo rotulo="Cidade">
                  {(p) => <Input {...p} value={form.cidade ?? ''} onChange={(e) => set('cidade', e.target.value)} />}
                </Campo>
                <Campo rotulo="UF">
                  {(p) => <Input {...p} maxLength={2} value={form.uf ?? ''} onChange={(e) => set('uf', e.target.value.toUpperCase())} />}
                </Campo>
              </div>
            </div>
          </div>
        )}
      </div>

      <Rodape>
        <Button variante="secundario" onClick={onVoltar}>
          Voltar
        </Button>
        <Button type="submit" disabled={!podeAvancar}>
          Continuar
        </Button>
      </Rodape>
    </form>
  )
}

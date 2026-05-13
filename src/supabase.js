import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase = createClient(supabaseUrl, supabaseKey)

// ─── Tarefas ──────────────────────────────────────────────────────────────────
export async function getTarefas() {
  const { data, error } = await supabase
    .from('tarefas').select('*')
    .order('data_estimada', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data.map(mapTarefa)
}
export async function upsertTarefa(t) {
  const { data, error } = await supabase
    .from('tarefas').upsert(unmapTarefa(t), { onConflict: 'id' })
    .select().single()
  if (error) throw error
  return mapTarefa(data)
}
export async function deleteTarefa(id) {
  const { error } = await supabase.from('tarefas').delete().eq('id', id)
  if (error) throw error
}
export async function deleteTarefasEmLote(ids) {
  const { error } = await supabase.from('tarefas').delete().in('id', ids)
  if (error) throw error
}

// ─── Histórico ────────────────────────────────────────────────────────────────
export async function addHistorico(tarefaId, campo, valorAntes, valorDepois, alteradoPor = 'usuário') {
  const { error } = await supabase.from('historico').insert({
    tarefa_id: tarefaId, campo,
    valor_antes: String(valorAntes ?? ''),
    valor_depois: String(valorDepois ?? ''),
    alterado_por: alteradoPor,
  })
  if (error) throw error
}
export async function getHistorico(tarefaId) {
  const { data, error } = await supabase
    .from('historico').select('*').eq('tarefa_id', tarefaId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// ─── Padrões ──────────────────────────────────────────────────────────────────
export async function getPadroes() {
  const { data, error } = await supabase
    .from('padroes').select('*').order('cliente')
  if (error) throw error
  return data.map(mapPadrao)
}
export async function upsertPadrao(p) {
  const { data, error } = await supabase
    .from('padroes').upsert(unmapPadrao(p), { onConflict: 'id' })
    .select().single()
  if (error) throw error
  return mapPadrao(data)
}
export async function deletePadrao(id) {
  const { error } = await supabase.from('padroes').delete().eq('id', id)
  if (error) throw error
}

// ─── Feriados ─────────────────────────────────────────────────────────────────
export async function getFeriados() {
  const { data, error } = await supabase
    .from('feriados_custom').select('*').order('data')
  if (error) throw error
  return data
}
export async function upsertFeriado(f) {
  const { data, error } = await supabase
    .from('feriados_custom').upsert(f, { onConflict: 'id' })
    .select().single()
  if (error) throw error
  return data
}
export async function deleteFeriado(id) {
  const { error } = await supabase.from('feriados_custom').delete().eq('id', id)
  if (error) throw error
}

// ─── Responsáveis ─────────────────────────────────────────────────────────────
export async function getResponsaveis() {
  const { data, error } = await supabase
    .from('responsaveis').select('*').eq('ativo', true).order('nome')
  if (error) throw error
  return data
}
export async function upsertResponsavel(r) {
  const { data, error } = await supabase
    .from('responsaveis').upsert(r, { onConflict: 'id' })
    .select().single()
  if (error) throw error
  return data
}
export async function deleteResponsavel(id) {
  const { error } = await supabase.from('responsaveis').delete().eq('id', id)
  if (error) throw error
}

// ─── Clientes ─────────────────────────────────────────────────────────────────
export async function getClientes() {
  const { data, error } = await supabase
    .from('clientes').select('*').eq('ativo', true).order('nome')
  if (error) throw error
  return data
}
export async function upsertCliente(c) {
  const { data, error } = await supabase
    .from('clientes').upsert(c, { onConflict: 'id' })
    .select().single()
  if (error) throw error
  return data
}
export async function deleteCliente(id) {
  const { error } = await supabase.from('clientes').delete().eq('id', id)
  if (error) throw error
}

// ─── Áreas ────────────────────────────────────────────────────────────────────
export async function getAreas() {
  const { data, error } = await supabase
    .from('areas').select('*').eq('ativo', true).order('nome')
  if (error) throw error
  return data
}
export async function upsertArea(a) {
  const { data, error } = await supabase
    .from('areas').upsert(a, { onConflict: 'id' })
    .select().single()
  if (error) throw error
  return data
}
export async function deleteArea(id) {
  const { error } = await supabase.from('areas').delete().eq('id', id)
  if (error) throw error
}

// ─── Mappers ──────────────────────────────────────────────────────────────────
function mapTarefa(r) {
  return {
    id: r.id, atividade: r.atividade, cliente: r.cliente, area: r.area,
    status: r.status, obs: r.obs ?? '', responsavel: r.responsavel ?? '',
    dataEstimada: r.data_estimada ?? '', dataExecucao: r.data_execucao ?? '',
    tipo: r.tipo ?? 'mensal', recorrenciaAnual: r.recorrencia_anual ?? false,
    createdAt: r.created_at, updatedAt: r.updated_at,
  }
}
function unmapTarefa(t) {
  const row = {
    atividade: t.atividade, cliente: t.cliente, area: t.area,
    status: t.status, obs: t.obs ?? '', responsavel: t.responsavel ?? '',
    data_estimada: t.dataEstimada || null, data_execucao: t.dataExecucao || null,
    tipo: t.tipo ?? 'mensal', recorrencia_anual: t.recorrenciaAnual ?? false,
  }
  if (t.id) row.id = t.id
  return row
}
function mapPadrao(r) {
  return {
    id: r.id, atividade: r.atividade, cliente: r.cliente, area: r.area,
    responsavel: r.responsavel ?? '', tipoPrazo: r.tipo_prazo, dia: r.dia,
    seNaoUtil: r.se_nao_util, tipo: r.tipo ?? 'mensal',
    recorrenciaAnual: r.recorrencia_anual ?? false,
  }
}
function unmapPadrao(p) {
  const row = {
    atividade: p.atividade, cliente: p.cliente, area: p.area,
    responsavel: p.responsavel ?? '', tipo_prazo: p.tipoPrazo, dia: p.dia,
    se_nao_util: p.seNaoUtil, tipo: p.tipo ?? 'mensal',
    recorrencia_anual: p.recorrenciaAnual ?? false,
  }
  if (p.id) row.id = p.id
  return row
}

import { useState, useMemo, useEffect, useRef } from "react";
import * as XLSX from 'xlsx';
import {
  getTarefas, upsertTarefa, deleteTarefa, deleteTarefasEmLote,
  getPadroes, upsertPadrao, deletePadrao, deletePadraoEmLote, insertPadraoEmLote,
  getFeriados, upsertFeriado, deleteFeriado,
  addHistorico, getHistorico,
  getResponsaveis, upsertResponsavel, deleteResponsavel,
  getClientes, upsertCliente, deleteCliente,
  getAreas, upsertArea, deleteArea,
} from "./supabase";

const C = {
  primary:"#EF4136",primary2:"#FF6B62",primary3:"#FFAAA6",
  primary4:"#FFF3F2",primary5:"#FFE0DE",dark:"#7A1A16",
  green:"#3B6D11",greenBg:"#EAF3DE",red:"#A32D2D",redBg:"#FCEBEB",
  purple:"#534AB7",gray:"#5F5E5A",navy:"#1B1F3B",
};
const CLIENT_COLORS = {
  "PROAUTO":    {bg:"#E6F1FB",border:"#85B7EB"},
  "GRUPO IN":   {bg:"#EAF3DE",border:"#97C459"},
  "METALOCK GR":{bg:C.primary4,border:C.primary3},
  "CAMPOVITA":  {bg:"#EEEDFE",border:"#AFA9EC"},
  "VANITY":     {bg:"#FAEEDA",border:"#EF9F27"},
};
const STATUS_COLORS = {
  "CONCLUÍDO":   {bg:"#EAF3DE",border:"#639922"},
  "EM ANÁLISE":  {bg:"#FAEEDA",border:"#BA7517"},
  "PENDENTE":    {bg:C.primary4,border:C.primary3},
  "ENCERRADO":   {bg:"#F1EFE8",border:"#888780"},
  "NA":          {bg:"#F1EFE8",border:"#888780"},
  "EM ANDAMENTO":{bg:C.primary5,border:C.primary2},
};
const AREA_COLORS_DEFAULT = {"FOLHA":C.primary,"PÓS FOLHA":C.green,"BENEFICIOS":C.purple};
const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MONTHS_OPT = ["","Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DAYS_W = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const STATUS_LIST = ["CONCLUÍDO","EM ANÁLISE","PENDENTE","EM ANDAMENTO","NA","ENCERRADO"];
const STATUS_F = ["Todos",...STATUS_LIST];

function getEaster(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;return new Date(y,mo-1,day);}
function getFeriadosMoveis(y){const e=getEaster(y),add=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);return[{data:add(e,-48),nome:"2ª Carnaval"},{data:add(e,-47),nome:"3ª Carnaval"},{data:add(e,-2),nome:"Sexta-feira Santa"},{data:add(e,60),nome:"Corpus Christi"}];}
function getFeriadosFixos(y){return[{data:new Date(y,0,1),nome:"Confraternização"},{data:new Date(y,3,21),nome:"Tiradentes"},{data:new Date(y,4,1),nome:"Dia do Trabalho"},{data:new Date(y,8,7),nome:"Independência"},{data:new Date(y,9,12),nome:"N. Sra. Aparecida"},{data:new Date(y,10,2),nome:"Finados"},{data:new Date(y,10,15),nome:"Proclamação da República"},{data:new Date(y,11,25),nome:"Natal"}];}
function isoOf(d){return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function buildHmap(year,custom){const m={};[...getFeriadosFixos(year),...getFeriadosMoveis(year)].forEach(f=>{m[isoOf(f.data)]=f.nome;});custom.forEach(f=>{if(f.data)m[f.data]=f.nome;});return m;}
function isWe(d){return d.getDay()===0||d.getDay()===6;}
function isUtil(d,hm){return!isWe(d)&&!hm[isoOf(d)];}
function ajustar(date,dir,hm){let d=new Date(date.getFullYear(),date.getMonth(),date.getDate());const s=dir==="avancar"?1:-1;d=new Date(d.getFullYear(),d.getMonth(),d.getDate()+s);while(!isUtil(d,hm))d=new Date(d.getFullYear(),d.getMonth(),d.getDate()+s);return d;}
function getNthUtil(y,m,n,hm){let cnt=0,d=new Date(y,m,1);while(true){if(isUtil(d,hm)){cnt++;if(cnt===n)return d;}d=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1);}}
function calcData(y,m,tipo,dia,seNaoUtil,hm){let d;if(tipo==="util")d=getNthUtil(y,m,dia,hm);else{const dim=new Date(y,m+1,0).getDate();d=new Date(y,m,Math.min(dia,dim));}if(tipo==="fixo"&&!isUtil(d,hm))d=ajustar(d,seNaoUtil,hm);return d;}
function toISO(d){return isoOf(d);}
function fmtDate(s){if(!s)return"-";const[y,m,dd]=s.split("-");return`${dd}/${m}/${y}`;}
function getDIM(y,m){return new Date(y,m+1,0).getDate();}
function getFD(y,m){return new Date(y,m,1).getDay();}

function Badge({status}){const c=STATUS_COLORS[status]||STATUS_COLORS["ENCERRADO"];return<span style={{background:c.bg,color:"#000",border:`1px solid ${c.border}`,borderRadius:4,padding:"2px 6px",fontSize:10,fontWeight:600,whiteSpace:"nowrap",display:"inline-block",maxWidth:"100%",overflow:"hidden",textOverflow:"ellipsis"}}>{status}</span>;}
function AreaBadge({area,areaColors}){const color=(areaColors&&areaColors[area])||AREA_COLORS_DEFAULT[area]||"#888";return<span style={{background:color+"22",color:"#000",border:`1px solid ${color}55`,borderRadius:4,padding:"2px 6px",fontSize:10,fontWeight:600,whiteSpace:"nowrap"}}>{area}</span>;}
function ClientBadge({cliente}){const c=CLIENT_COLORS[cliente]||{bg:"#eee",border:"#ccc"};return<span style={{background:c.bg,color:"#000",border:`1px solid ${c.border}`,borderRadius:4,padding:"2px 6px",fontSize:10,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%",display:"block"}}>{cliente}</span>;}
function TipoBadge({tipo}){return<span style={{background:tipo==="anual"?"#EEEDFE":"#E6F1FB",color:"#000",border:`1px solid ${tipo==="anual"?"#AFA9EC":"#85B7EB"}`,borderRadius:4,padding:"2px 6px",fontSize:10,fontWeight:600,whiteSpace:"nowrap"}}>{tipo==="anual"?"Anual":"Mensal"}</span>;}

const inp={border:`0.5px solid ${C.primary3}`,borderRadius:6,padding:"6px 10px",fontSize:13,background:"#fff",color:"#000",width:"100%",boxSizing:"border-box"};
function Field({label,children}){return<div style={{marginBottom:12}}><label style={{fontSize:12,color:"#000",display:"block",marginBottom:4,fontWeight:500}}>{label}</label>{children}</div>;}
function BtnP({onClick,disabled,children,small}){return<button onClick={onClick} disabled={disabled} style={{padding:small?"5px 12px":"7px 18px",borderRadius:7,border:"none",background:disabled?"#ccc":`linear-gradient(135deg,${C.primary},${C.navy})`,color:"#fff",cursor:disabled?"not-allowed":"pointer",fontSize:small?12:13,fontWeight:600}}>{children}</button>;}
function BtnD({onClick,children}){return<button onClick={onClick} style={{padding:"7px 14px",borderRadius:7,border:`0.5px solid ${C.red}`,background:C.redBg,color:"#000",cursor:"pointer",fontSize:13}}>{children}</button>;}
function BtnG({onClick,children}){return<button onClick={onClick} style={{padding:"7px 14px",borderRadius:7,border:`0.5px solid ${C.primary3}`,background:"transparent",color:C.primary,cursor:"pointer",fontSize:13}}>{children}</button>;}

function Modal({onClose,title,maxW,children}){
  return<div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
    <div onClick={e=>e.stopPropagation()} style={{background:C.primary4,borderRadius:14,border:`1.5px solid ${C.primary3}`,padding:0,maxWidth:maxW||490,width:"93%",maxHeight:"92vh",overflowY:"auto",boxSizing:"border-box"}}>
      <div style={{background:`linear-gradient(135deg,${C.primary},${C.navy})`,borderRadius:"12px 12px 0 0",padding:"13px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontWeight:600,fontSize:14,color:"#fff"}}>{title}</span>
        <button onClick={onClose} style={{border:"none",background:"rgba(255,255,255,0.2)",cursor:"pointer",fontSize:15,color:"#fff",width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
      </div>
      <div style={{padding:"18px 20px"}}>{children}</div>
    </div>
  </div>;
}

function ConfigSection({title,items,onAdd,onEdit,onDelete,newItem,setNewItem,editItem,setEditItem,placeholder}){
  return<div style={{marginBottom:28}}>
    <div style={{fontSize:14,fontWeight:600,color:"#000",marginBottom:12,borderBottom:`2px solid ${C.primary3}`,paddingBottom:6}}>{title}</div>
    <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,marginBottom:12}}>
      <thead><tr style={{background:C.primary4}}><th style={{textAlign:"left",padding:"7px 10px",fontWeight:600,fontSize:11,color:"#000"}}>Nome</th><th style={{width:80}}></th></tr></thead>
      <tbody>{items.map((it,idx)=><tr key={it.id} style={{borderBottom:`0.5px solid ${C.primary5}`,background:idx%2===0?"#fff":C.primary4}}>
        {editItem&&editItem.id===it.id
          ?<td style={{padding:"5px 8px"}} colSpan={2}><div style={{display:"flex",gap:8,alignItems:"center"}}><input value={editItem.nome} onChange={e=>setEditItem({...editItem,nome:e.target.value})} style={{...inp,flex:1}}/><BtnP onClick={()=>onEdit(editItem)} small>Salvar</BtnP><BtnD onClick={()=>onDelete(it.id)}>Excluir</BtnD><BtnG onClick={()=>setEditItem(null)}>Cancelar</BtnG></div></td>
          :<><td style={{padding:"7px 10px",color:"#000"}}>{it.nome}</td><td style={{padding:"7px 8px",textAlign:"right"}}><button onClick={()=>setEditItem({...it})} style={{border:`1px solid ${C.primary3}`,background:C.primary4,cursor:"pointer",color:C.primary,fontSize:11,padding:"2px 8px",borderRadius:5}}>Editar</button></td></>}
      </tr>)}</tbody>
    </table>
    <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
      <div style={{flex:1}}><input value={newItem} onChange={e=>setNewItem(e.target.value)} placeholder={placeholder} style={inp}/></div>
      <BtnP onClick={onAdd} disabled={!newItem.trim()}>+ Adicionar</BtnP>
    </div>
  </div>;
}

export default function App(){
  const [view,setView]        = useState("dashboard");
  const [tasks,setTasks]      = useState([]);
  const [padrao,setPadrao]    = useState([]);
  const [feriados,setFeriados]= useState([]);
  const [responsaveis,setResponsaveis] = useState([]);
  const [clientes,setClientes]= useState([]);
  const [areas,setAreas]      = useState([]);
  const [loading,setLoading]  = useState(true);
  const [saving,setSaving]    = useState(false);
  const [filters,setFilters]  = useState({cliente:"Todos",area:"Todas",responsavel:"Todos",status:"Todos",tipo:"Todos",search:""});
  const [calMonth,setCalMonth]= useState(new Date().getMonth());
  const [calYear,setCalYear]  = useState(new Date().getFullYear());
  const [modalCal,setModalCal]= useState(null);
  const [editTask,setEditTask]= useState(null);
  const [showAdd,setShowAdd]  = useState(false);
  const [newTask,setNewTask]  = useState({atividade:"",cliente:"",area:"",status:"PENDENTE",obs:"",dataEstimada:"",dataExecucao:"",responsavel:"",tipo:"mensal",recorrenciaAnual:false});
  const [selected,setSelected]= useState([]);
  const [showConfirmDel,setShowConfirmDel] = useState(false);
  const [showGerar,setShowGerar]       = useState(false);
  const [gerarPreview,setGerarPreview] = useState([]);
  const [gerarMes,setGerarMes]         = useState(null);
  const [showGerarAnual,setShowGerarAnual]       = useState(false);
  const [gerarAnualPreview,setGerarAnualPreview] = useState([]);
  const [gerarAnualAno,setGerarAnualAno]         = useState(null);
  const [editPadrao,setEditPadrao]       = useState(null);
  const [showAddPadrao,setShowAddPadrao] = useState(false);
  const [newPadrao,setNewPadrao] = useState({atividade:"",cliente:"",area:"",responsavel:"",tipoPrazo:"fixo",dia:1,seNaoUtil:"recuar",tipo:"mensal",recorrenciaAnual:false,mes:null});
  const [replicarTodos,setReplicarTodos] = useState(false);
  const fileInputRef = useRef(null);
  const [padraoFiltro,setPadraoFiltro]  = useState("Todos");
  const [padraoTipoFiltro,setPadraoTipoFiltro] = useState("Todos");
  const [selectedPadrao,setSelectedPadrao] = useState([]);
  const [showConfirmDelPadrao,setShowConfirmDelPadrao] = useState(false);
  const [showImportar,setShowImportar] = useState(false);
  const [importarLinhas,setImportarLinhas] = useState([{atividade:"",cliente:"",area:"",responsavel:"",tipoPrazo:"fixo",dia:1,mes:null,seNaoUtil:"recuar",tipo:"mensal",recorrenciaAnual:false}]);
  const [showFeriados,setShowFeriados]   = useState(false);
  const [newFeriado,setNewFeriado]       = useState({data:"",nome:""});
  const [editFeriado,setEditFeriado]     = useState(null);
  const [editCalTask,setEditCalTask]     = useState(null);
  const [showHistorico,setShowHistorico] = useState(null);
  const [historico,setHistorico]         = useState([]);
  const [showEscolhaMes,setShowEscolhaMes]   = useState(false);
  const [escolhaMes,setEscolhaMes]           = useState(()=>{const n=new Date();let m=n.getMonth()+1,y=n.getFullYear();if(m>11){m=0;y++;}return`${y}-${String(m+1).padStart(2,"0")}`;});
  const [showEscolhaAno,setShowEscolhaAno]   = useState(false);
  const [escolhaAno,setEscolhaAno]           = useState(String(new Date().getFullYear()));
  const [newResp,setNewResp]   = useState("");
  const [editResp,setEditResp] = useState(null);
  const [newCli,setNewCli]     = useState("");
  const [editCli,setEditCli]   = useState(null);
  const [newArea,setNewArea]   = useState("");
  const [editAreaItem,setEditAreaItem] = useState(null);

  useEffect(()=>{
    async function load(){
      setLoading(true);
      try{const[t,p,f,r,c,a]=await Promise.all([getTarefas(),getPadroes(),getFeriados(),getResponsaveis(),getClientes(),getAreas()]);setTasks(t);setPadrao(p);setFeriados(f);setResponsaveis(r);setClientes(c);setAreas(a);}
      catch(e){alert("Erro ao carregar: "+e.message);}
      setLoading(false);
    }
    load();
  },[]);

  const nomes={responsaveis:responsaveis.map(r=>r.nome),clientes:clientes.map(c=>c.nome),areas:areas.map(a=>a.nome)};
  const areaColors=useMemo(()=>{const colors=["#EF4136","#3B6D11","#534AB7","#185FA5","#854F0B","#A32D2D","#1A7A4A"];const m={};areas.forEach((a,i)=>{m[a.nome]=colors[i%colors.length];});return m;},[areas]);
  const hmap=useMemo(()=>buildHmap(calYear,feriados),[calYear,feriados]);

  const filtered=useMemo(()=>tasks.filter(t=>{
    if(filters.cliente!=="Todos"&&t.cliente!==filters.cliente)return false;
    if(filters.area!=="Todas"&&t.area!==filters.area)return false;
    if(filters.responsavel!=="Todos"&&t.responsavel!==filters.responsavel)return false;
    if(filters.status!=="Todos"&&t.status!==filters.status)return false;
    if(filters.tipo!=="Todos"&&t.tipo!==filters.tipo)return false;
    if(filters.search&&!t.atividade.toLowerCase().includes(filters.search.toLowerCase())&&!t.cliente.toLowerCase().includes(filters.search.toLowerCase()))return false;
    return true;
  }),[tasks,filters]);

  const stats=useMemo(()=>({total:tasks.length,concluido:tasks.filter(t=>t.status==="CONCLUÍDO").length,analise:tasks.filter(t=>t.status==="EM ANÁLISE").length,pendente:tasks.filter(t=>["PENDENTE","EM ANDAMENTO"].includes(t.status)).length,na:tasks.filter(t=>t.status==="NA").length}),[tasks]);
  const pct=stats.total?Math.round((stats.concluido/stats.total)*100):0;

  const calTasks=useMemo(()=>{const map={};tasks.forEach(t=>{if(!t.dataEstimada)return;const[y,m,d]=t.dataEstimada.split("-").map(Number);if(m-1===calMonth&&y===calYear){if(!map[d])map[d]=[];map[d].push(t);}});return map;},[tasks,calMonth,calYear]);

  async function saveEdit(){setSaving(true);try{const original=tasks.find(t=>t.id===editTask.id);for(const c of["status","responsavel","dataExecucao","obs","tipo"]){if(original[c]!==editTask[c])await addHistorico(editTask.id,c,original[c],editTask[c]);}const updated=await upsertTarefa(editTask);setTasks(tasks.map(t=>t.id===updated.id?updated:t));setEditTask(null);}catch(e){alert("Erro: "+e.message);}setSaving(false);}
  async function handleDeleteTask(id){setSaving(true);try{await deleteTarefa(id);setTasks(tasks.filter(t=>t.id!==id));setEditTask(null);}catch(e){alert("Erro: "+e.message);}setSaving(false);}
  async function addTask(){setSaving(true);try{const t=await upsertTarefa(newTask);setTasks([...tasks,t]);setShowAdd(false);setNewTask({atividade:"",cliente:"",area:"",status:"PENDENTE",obs:"",dataEstimada:"",dataExecucao:"",responsavel:"",tipo:"mensal",recorrenciaAnual:false});}catch(e){alert("Erro: "+e.message);}setSaving(false);}
  async function handleDeleteEmLote(){setSaving(true);try{await deleteTarefasEmLote(selected);setTasks(tasks.filter(t=>!selected.includes(t.id)));setSelected([]);setShowConfirmDel(false);}catch(e){alert("Erro: "+e.message);}setSaving(false);}
  function toggleSelect(id){setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);}
  function toggleSelectAll(){setSelected(selected.length===filtered.length?[]:filtered.map(t=>t.id));}
  async function saveCalTask(){setSaving(true);try{const original=tasks.find(t=>t.id===editCalTask.id);for(const c of["status","responsavel","dataExecucao"]){if(original[c]!==editCalTask[c])await addHistorico(editCalTask.id,c,original[c],editCalTask[c]);}const updated=await upsertTarefa(editCalTask);setTasks(tasks.map(t=>t.id===updated.id?updated:t));setEditCalTask(null);}catch(e){alert("Erro: "+e.message);}setSaving(false);}

  function handleGerarPreview(){const[yStr,mStr]=escolhaMes.split("-");const ny=Number(yStr),nm=Number(mStr)-1;const hm=buildHmap(ny,feriados);setGerarMes({mes:nm,ano:ny});const preview=padrao.filter(p=>p.tipo==="mensal").map((p,i)=>{const d=calcData(ny,nm,p.tipoPrazo,p.dia,p.seNaoUtil,hm);const iso=toISO(d);const orig=new Date(ny,nm,Math.min(p.dia,getDIM(ny,nm)));return{...p,dataEstimada:iso,dataExecucao:"",status:"PENDENTE",responsavel:"",tipo:"mensal",adjusted:iso!==toISO(orig),_i:i};});setGerarPreview(preview);setShowGerar(true);}
  async function handleConfirmarGerar(){setSaving(true);try{const novas=await Promise.all(gerarPreview.map(p=>upsertTarefa({atividade:p.atividade,cliente:p.cliente,area:p.area,status:"PENDENTE",obs:"",dataEstimada:p.dataEstimada,dataExecucao:"",responsavel:"",tipo:"mensal",recorrenciaAnual:false})));setTasks([...tasks,...novas]);setShowGerar(false);setView("tarefas");}catch(e){alert("Erro: "+e.message);}setSaving(false);}

  function handleGerarAnualPreview(){const ny=Number(escolhaAno);const hm=buildHmap(ny,feriados);setGerarAnualAno(ny);const preview=padrao.filter(p=>p.tipo==="anual").map((p,i)=>{const nm=(p.mes!=null?p.mes:1)-1;const d=calcData(ny,nm,p.tipoPrazo,p.dia,p.seNaoUtil,hm);const iso=toISO(d);return{...p,dataEstimada:iso,dataExecucao:"",status:"PENDENTE",responsavel:"",tipo:"anual",adjusted:false,_i:i};});setGerarAnualPreview(preview);setShowGerarAnual(true);}
  async function handleConfirmarGerarAnual(){setSaving(true);try{const novas=await Promise.all(gerarAnualPreview.map(p=>upsertTarefa({atividade:p.atividade,cliente:p.cliente,area:p.area,status:"PENDENTE",obs:"",dataEstimada:p.dataEstimada,dataExecucao:"",responsavel:"",tipo:"anual",recorrenciaAnual:p.recorrenciaAnual})));setTasks([...tasks,...novas]);setShowGerarAnual(false);setView("tarefas");}catch(e){alert("Erro: "+e.message);}setSaving(false);}

  async function savePadrao(){setSaving(true);try{const p=await upsertPadrao(editPadrao);setPadrao(padrao.map(x=>x.id===p.id?p:x));setEditPadrao(null);}catch(e){alert("Erro: "+e.message);}setSaving(false);}
  async function handleDeletePadrao(id){setSaving(true);try{await deletePadrao(id);setPadrao(padrao.filter(p=>p.id!==id));setEditPadrao(null);}catch(e){alert("Erro: "+e.message);}setSaving(false);}
  async function addPadrao(){
    setSaving(true);
    try{
      if(replicarTodos && nomes.clientes.length > 0){
        // cria um padrão para cada cliente, responsável em branco
        const lista = nomes.clientes.map(cli=>({...newPadrao, cliente: cli, responsavel:""}));
        const novos = await insertPadraoEmLote(lista);
        setPadrao([...padrao,...novos]);
        alert(`✅ ${novos.length} padrão(ões) criados para todos os clientes!`);
      } else {
        const p = await upsertPadrao(newPadrao);
        setPadrao([...padrao,p]);
      }
      setShowAddPadrao(false);
      setReplicarTodos(false);
      setNewPadrao({atividade:"",cliente:"",area:"",responsavel:"",tipoPrazo:"fixo",dia:1,seNaoUtil:"recuar",tipo:"mensal",recorrenciaAnual:false,mes:null});
    }catch(e){alert("Erro: "+e.message);}
    setSaving(false);
  }

  // ── Baixar modelo Excel ───────────────────────────────────────────────────
  function baixarModeloExcel(){
    const cabecalho = [["Atividade","Cliente","Área","Responsável","Tipo (mensal/anual)","Tipo Prazo (fixo/util)","Dia","Mês (1-12, só anual)","Se Não Útil (recuar/avancar)","Recorrência Anual (sim/nao)"]];
    const exemplos = [
      ["Calculo de adiantamento","PROAUTO","FOLHA","","mensal","fixo",10,"","recuar","nao"],
      ["Folha de 13º Salário","GRUPO IN","FOLHA","","anual","fixo",20,11,"recuar","sim"],
    ];
    const ws = XLSX.utils.aoa_to_sheet([...cabecalho,...exemplos]);
    ws['!cols'] = Array(10).fill({wch:22});
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Padrões");
    XLSX.writeFile(wb, "modelo_padroes_bpo.xlsx");
  }

  // ── Importar Excel ────────────────────────────────────────────────────────
  async function handleImportarExcel(e){
    const file = e.target.files[0];
    if(!file) return;
    try{
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:""});
      // pular cabeçalho (linha 0)
      const dados = rows.slice(1).filter(r=>r[0]&&r[1]&&r[2]);
      if(!dados.length){ alert("Nenhuma linha válida encontrada. Verifique o arquivo."); return; }
      const lista = dados.map(r=>({
        atividade: String(r[0]||"").trim(),
        cliente:   String(r[1]||"").trim(),
        area:      String(r[2]||"").trim(),
        responsavel: String(r[3]||"").trim(),
        tipo:      String(r[4]||"mensal").trim().toLowerCase()==="anual"?"anual":"mensal",
        tipoPrazo: String(r[5]||"fixo").trim().toLowerCase()==="util"?"util":"fixo",
        dia:       Number(r[6])||1,
        mes:       r[7]?Number(r[7])||null:null,
        seNaoUtil: String(r[8]||"recuar").trim().toLowerCase()==="avancar"?"avancar":"recuar",
        recorrenciaAnual: String(r[9]||"nao").trim().toLowerCase()==="sim",
      }));
      setSaving(true);
      const novos = await insertPadraoEmLote(lista);
      setPadrao([...padrao,...novos]);
      alert(`✅ ${novos.length} padrão(ões) importado(s) com sucesso!`);
    }catch(e){alert("Erro ao importar: "+e.message);}
    setSaving(false);
    e.target.value="";
  }
  async function handleDeletePadraoEmLote(){setSaving(true);try{await deletePadraoEmLote(selectedPadrao);setPadrao(padrao.filter(p=>!selectedPadrao.includes(p.id)));setSelectedPadrao([]);setShowConfirmDelPadrao(false);}catch(e){alert("Erro: "+e.message);}setSaving(false);}
  function toggleSelectPadrao(id){setSelectedPadrao(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);}
  function toggleSelectAllPadrao(){setSelectedPadrao(selectedPadrao.length===padraoFiltrado.length?[]:padraoFiltrado.map(p=>p.id));}
  async function handleImportarPadroes(){const validos=importarLinhas.filter(l=>l.atividade.trim()&&l.cliente.trim()&&l.area.trim());if(!validos.length){alert("Preencha pelo menos uma linha completa.");return;}setSaving(true);try{const novos=await insertPadraoEmLote(validos);setPadrao([...padrao,...novos]);setShowImportar(false);setImportarLinhas([{atividade:"",cliente:"",area:"",responsavel:"",tipoPrazo:"fixo",dia:1,mes:null,seNaoUtil:"recuar",tipo:"mensal",recorrenciaAnual:false}]);alert(`${novos.length} padrão(ões) importado(s) com sucesso!`);}catch(e){alert("Erro: "+e.message);}setSaving(false);}
  function addLinhaImportar(){setImportarLinhas([...importarLinhas,{atividade:"",cliente:"",area:"",responsavel:"",tipoPrazo:"fixo",dia:1,mes:null,seNaoUtil:"recuar",tipo:"mensal",recorrenciaAnual:false}]);}
  function removeLinhaImportar(i){setImportarLinhas(importarLinhas.filter((_,idx)=>idx!==i));}
  function updateLinhaImportar(i,k,v){const u=[...importarLinhas];u[i]={...u[i],[k]:v};setImportarLinhas(u);}

  async function addFeriado(){if(!newFeriado.data||!newFeriado.nome)return;setSaving(true);try{const f=await upsertFeriado(newFeriado);setFeriados([...feriados,f]);setNewFeriado({data:"",nome:""});}catch(e){alert("Erro: "+e.message);}setSaving(false);}
  async function handleDeleteFeriado(id){setSaving(true);try{await deleteFeriado(id);setFeriados(feriados.filter(f=>f.id!==id));setEditFeriado(null);}catch(e){alert("Erro: "+e.message);}setSaving(false);}
  async function saveFeriado(){setSaving(true);try{const f=await upsertFeriado(editFeriado);setFeriados(feriados.map(x=>x.id===f.id?f:x));setEditFeriado(null);}catch(e){alert("Erro: "+e.message);}setSaving(false);}

  async function addResp(){if(!newResp.trim())return;setSaving(true);try{const r=await upsertResponsavel({nome:newResp.trim()});setResponsaveis([...responsaveis,r]);setNewResp("");}catch(e){alert("Erro: "+e.message);}setSaving(false);}
  async function saveResp(){setSaving(true);try{const r=await upsertResponsavel(editResp);setResponsaveis(responsaveis.map(x=>x.id===r.id?r:x));setEditResp(null);}catch(e){alert("Erro: "+e.message);}setSaving(false);}
  async function delResp(id){setSaving(true);try{await deleteResponsavel(id);setResponsaveis(responsaveis.filter(r=>r.id!==id));setEditResp(null);}catch(e){alert("Erro: "+e.message);}setSaving(false);}
  async function addCli(){if(!newCli.trim())return;setSaving(true);try{const c=await upsertCliente({nome:newCli.trim()});setClientes([...clientes,c]);setNewCli("");}catch(e){alert("Erro: "+e.message);}setSaving(false);}
  async function saveCli(){setSaving(true);try{const c=await upsertCliente(editCli);setClientes(clientes.map(x=>x.id===c.id?c:x));setEditCli(null);}catch(e){alert("Erro: "+e.message);}setSaving(false);}
  async function delCli(id){setSaving(true);try{await deleteCliente(id);setClientes(clientes.filter(c=>c.id!==id));setEditCli(null);}catch(e){alert("Erro: "+e.message);}setSaving(false);}
  async function addAreaItem(){if(!newArea.trim())return;setSaving(true);try{const a=await upsertArea({nome:newArea.trim()});setAreas([...areas,a]);setNewArea("");}catch(e){alert("Erro: "+e.message);}setSaving(false);}
  async function saveAreaItem(){setSaving(true);try{const a=await upsertArea(editAreaItem);setAreas(areas.map(x=>x.id===a.id?a:x));setEditAreaItem(null);}catch(e){alert("Erro: "+e.message);}setSaving(false);}
  async function delAreaItem(id){setSaving(true);try{await deleteArea(id);setAreas(areas.filter(a=>a.id!==id));setEditAreaItem(null);}catch(e){alert("Erro: "+e.message);}setSaving(false);}
  async function abrirHistorico(tarefa){setShowHistorico(tarefa);try{const h=await getHistorico(tarefa.id);setHistorico(h);}catch{setHistorico([]);}}

  const padraoFiltrado=padrao.filter(p=>(padraoFiltro==="Todos"||p.cliente===padraoFiltro)&&(padraoTipoFiltro==="Todos"||p.tipo===padraoTipoFiltro));
  const thS={textAlign:"left",padding:"9px 10px",fontWeight:600,fontSize:11,color:"#000",whiteSpace:"nowrap",borderBottom:`2px solid ${C.primary3}`};
  const tdS=(idx)=>({borderBottom:"0.5px solid #eee",background:idx%2===0?"#fff":"#fafafa"});
  const navBtn=(v,label)=>{const act=view===v;return<button key={v} onClick={()=>setView(v)} style={{padding:"6px 14px",fontSize:13,borderRadius:7,border:`1.5px solid ${act?C.primary:"rgba(255,255,255,0.3)"}`,background:act?C.primary:"transparent",color:"#fff",cursor:"pointer",fontWeight:act?600:400}}>{label}</button>;};

  function TF(obj,set){return<>
    {[{l:"Atividade",k:"atividade",t:"text"},{l:"Observação",k:"obs",t:"text"},{l:"Data estimada",k:"dataEstimada",t:"date"},{l:"Data de execução",k:"dataExecucao",t:"date"}].map(f=><Field key={f.k} label={f.l}><input type={f.t} value={obj[f.k]} onChange={e=>set({...obj,[f.k]:e.target.value})} style={inp}/></Field>)}
    <Field label="Tipo de tarefa"><select value={obj.tipo} onChange={e=>set({...obj,tipo:e.target.value})} style={inp}><option value="mensal">Mensal</option><option value="anual">Anual</option></select></Field>
    {obj.tipo==="anual"&&<Field label="Recorrência anual?"><select value={obj.recorrenciaAnual?"sim":"nao"} onChange={e=>set({...obj,recorrenciaAnual:e.target.value==="sim"})} style={inp}><option value="sim">Sim, repete todo ano</option><option value="nao">Não, data única</option></select></Field>}
    {[{l:"Status",k:"status",opts:STATUS_LIST},{l:"Área",k:"area",opts:nomes.areas},{l:"Responsável",k:"responsavel",opts:["","...nomes.responsaveis]",...nomes.responsaveis]},{l:"Cliente",k:"cliente",opts:nomes.clientes}].map(f=><Field key={f.k} label={f.l}><select value={obj[f.k]} onChange={e=>set({...obj,[f.k]:e.target.value})} style={inp}>{(f.k==="responsavel"?["","...nomes.responsaveis]",...nomes.responsaveis]:f.opts).map(o=><option key={o}>{o}</option>)}</select></Field>)}
  </>;}

  function PF(obj,set){return<>
    <Field label="Atividade"><input value={obj.atividade} onChange={e=>set({...obj,atividade:e.target.value})} style={inp}/></Field>
    {[{l:"Cliente",k:"cliente",opts:nomes.clientes},{l:"Área",k:"area",opts:nomes.areas},{l:"Responsável",k:"responsavel",opts:["","...nomes.responsaveis]",...nomes.responsaveis]}].map(f=><Field key={f.k} label={f.l}><select value={obj[f.k]} onChange={e=>set({...obj,[f.k]:e.target.value})} style={inp}>{(f.k==="responsavel"?["","...nomes.responsaveis]",...nomes.responsaveis]:f.opts).map(o=><option key={o}>{o}</option>)}</select></Field>)}
    <Field label="Tipo de prazo"><select value={obj.tipoPrazo} onChange={e=>set({...obj,tipoPrazo:e.target.value})} style={inp}><option value="fixo">Dia fixo do mês</option><option value="util">Nº do dia útil</option></select></Field>
    <Field label={obj.tipoPrazo==="util"?"Qual dia útil?":"Dia do mês"}><input type="number" min="1" max={obj.tipoPrazo==="util"?22:31} value={obj.dia} onChange={e=>set({...obj,dia:Number(e.target.value)})} style={inp}/></Field>
    <Field label="Se cair em feriado / fim de semana"><select value={obj.seNaoUtil} onChange={e=>set({...obj,seNaoUtil:e.target.value})} style={inp}><option value="recuar">↩ Recuar</option><option value="avancar">↪ Avançar</option></select></Field>
    <Field label="Tipo de tarefa"><select value={obj.tipo} onChange={e=>set({...obj,tipo:e.target.value,mes:null})} style={inp}><option value="mensal">Mensal</option><option value="anual">Anual</option></select></Field>
    {obj.tipo==="anual"&&<>
      <Field label="Mês de execução"><select value={obj.mes??""} onChange={e=>set({...obj,mes:e.target.value?Number(e.target.value):null})} style={inp}>{MONTHS_OPT.map((m,i)=><option key={i} value={i===0?"":i}>{i===0?"— Selecione o mês —":m}</option>)}</select></Field>
      <Field label="Recorrência anual?"><select value={obj.recorrenciaAnual?"sim":"nao"} onChange={e=>set({...obj,recorrenciaAnual:e.target.value==="sim"})} style={inp}><option value="sim">Sim, repete todo ano</option><option value="nao">Não, data única</option></select></Field>
    </>}
  </>;}

  if(loading)return<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",flexDirection:"column",gap:16,background:C.primary4}}><div style={{width:48,height:48,border:`4px solid ${C.primary3}`,borderTopColor:C.primary,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/><div style={{color:C.primary,fontWeight:600}}>Carregando dados...</div><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;

  return<div style={{fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",color:"#000",paddingBottom:"2rem",minHeight:"100vh"}}>
    {saving&&<div style={{position:"fixed",top:0,left:0,right:0,height:3,background:C.primary,zIndex:200}}/>}

    {/* Header */}
    <div style={{padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap",background:C.navy}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:36,height:36,borderRadius:8,background:C.primary,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#fff",fontSize:15,fontWeight:700}}>H</span></div>
        <div><div style={{fontWeight:700,fontSize:15,color:"#fff"}}>Hability · BPO Trabalhista</div><div style={{fontSize:11,color:C.primary3}}>Controle de serviços e prazos</div></div>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
        {navBtn("dashboard","Dashboard")}
        {navBtn("calendario","Calendário")}
        {navBtn("tarefas","Tarefas")}
        {navBtn("padrao","Padrões")}
        {navBtn("configuracoes","⚙️ Config")}
        <button onClick={()=>setShowFeriados(true)} style={{padding:"6px 12px",fontSize:13,borderRadius:7,border:`1.5px solid ${C.primary3}`,background:"transparent",color:"#fff",cursor:"pointer"}}>📅 Feriados</button>
        <button onClick={()=>setShowEscolhaMes(true)} style={{padding:"6px 12px",fontSize:13,borderRadius:7,border:"none",background:C.primary,color:"#fff",cursor:"pointer",fontWeight:600}}>✦ Gerar mês</button>
        <button onClick={()=>setShowEscolhaAno(true)} style={{padding:"6px 12px",fontSize:13,borderRadius:7,border:`1.5px solid ${C.primary3}`,background:"transparent",color:"#fff",cursor:"pointer",fontWeight:600}}>📆 Gerar anual</button>
      </div>
    </div>

    {/* Dashboard */}
    {view==="dashboard"&&<div style={{padding:"20px"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:12,marginBottom:24}}>
        {[{l:"Total",v:stats.total,c:C.primary},{l:"Concluídas",v:stats.concluido,c:C.green},{l:"Em análise",v:stats.analise,c:C.gray},{l:"Pendentes",v:stats.pendente,c:C.primary},{l:"N/A",v:stats.na,c:C.gray}].map(s=><div key={s.l} style={{background:C.primary4,borderRadius:10,padding:"14px 16px",border:`1px solid ${C.primary5}`}}><div style={{fontSize:12,marginBottom:4}}>{s.l}</div><div style={{fontSize:26,fontWeight:700,color:s.c}}>{s.v}</div></div>)}
      </div>
      <div style={{background:C.primary4,borderRadius:10,padding:"16px",marginBottom:24,border:`1px solid ${C.primary5}`}}>
        <div style={{fontSize:13,fontWeight:500,marginBottom:8}}>Taxa de conclusão</div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{flex:1,height:10,background:C.primary5,borderRadius:99,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:`linear-gradient(90deg,${C.primary},${C.navy})`,borderRadius:99}}/></div>
          <span style={{fontSize:14,fontWeight:700,color:C.primary}}>{pct}%</span>
        </div>
      </div>
      <div style={{fontSize:14,fontWeight:600,marginBottom:12}}>Por cliente</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:24}}>
        {clientes.map(cli=>{const ct=tasks.filter(t=>t.cliente===cli.nome),cc=ct.filter(t=>t.status==="CONCLUÍDO").length,p=ct.length?Math.round((cc/ct.length)*100):0,cc2=CLIENT_COLORS[cli.nome]||{bg:"#eee",border:"#ccc"};return<div key={cli.id} style={{background:cc2.bg,border:`1px solid ${cc2.border}`,borderRadius:10,padding:"12px 14px"}}><div style={{fontSize:12,fontWeight:600,marginBottom:4}}>{cli.nome}</div><div style={{fontSize:11,marginBottom:6}}>{cc}/{ct.length} concluídas</div><div style={{height:6,background:"#fff",borderRadius:99,overflow:"hidden"}}><div style={{width:`${p}%`,height:"100%",background:`linear-gradient(90deg,${C.primary},${C.navy})`,borderRadius:99}}/></div></div>;})}
      </div>
      <div style={{fontSize:14,fontWeight:600,marginBottom:12}}>Por responsável</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
        {responsaveis.map(r=>{const rt=tasks.filter(t=>t.responsavel===r.nome),rc=rt.filter(t=>t.status==="CONCLUÍDO").length;return<div key={r.id} style={{background:"#fff",border:`1px solid ${C.primary5}`,borderRadius:10,padding:"12px 14px",display:"flex",alignItems:"center",gap:12}}><div style={{width:36,height:36,borderRadius:"50%",background:C.navy,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#fff",flexShrink:0}}>{r.nome.slice(0,2)}</div><div><div style={{fontSize:13,fontWeight:600}}>{r.nome}</div><div style={{fontSize:11}}>{rc}/{rt.length} concluídas</div></div></div>;})}
      </div>
    </div>}

    {/* Calendário */}
    {view==="calendario"&&<div style={{padding:"20px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <button onClick={()=>{if(calMonth===0){setCalMonth(11);setCalYear(calYear-1);}else setCalMonth(calMonth-1);}} style={{border:`1px solid ${C.primary3}`,background:"transparent",borderRadius:7,padding:"5px 12px",cursor:"pointer",color:C.primary,fontSize:16}}>‹</button>
        <span style={{fontWeight:600,fontSize:15,minWidth:140,textAlign:"center"}}>{MONTHS[calMonth]} {calYear}</span>
        <button onClick={()=>{if(calMonth===11){setCalMonth(0);setCalYear(calYear+1);}else setCalMonth(calMonth+1);}} style={{border:`1px solid ${C.primary3}`,background:"transparent",borderRadius:7,padding:"5px 12px",cursor:"pointer",color:C.primary,fontSize:16}}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:2}}>{DAYS_W.map(d=><div key={d} style={{textAlign:"center",fontSize:11,fontWeight:600,padding:"4px 0"}}>{d}</div>)}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {Array(getFD(calYear,calMonth)).fill(null).map((_,i)=><div key={"e"+i}/>)}
        {Array(getDIM(calYear,calMonth)).fill(null).map((_,i)=>{
          const day=i+1,dayTasks=calTasks[day]||[],today=new Date();
          const isToday=today.getDate()===day&&today.getMonth()===calMonth&&today.getFullYear()===calYear;
          const dateObj=new Date(calYear,calMonth,day),iso=isoOf(dateObj),isH=!!hmap[iso],isW=isWe(dateObj),hn=hmap[iso]||"";
          return<div key={day} onClick={()=>setModalCal({day,tasks:dayTasks,holName:hn,iso})} style={{minHeight:72,border:`1px solid ${isToday?C.primary:isH?C.primary2:"#e5e5e5"}`,borderRadius:7,padding:"4px 5px",cursor:"pointer",background:isToday?C.primary5:isH?C.primary4:isW?"#f9f9f9":"#fff"}}>
            <div style={{fontSize:11,fontWeight:isToday?700:400,marginBottom:1}}>{day}{isH?" 🎉":""}</div>
            {isH&&<div style={{fontSize:9,color:C.dark,fontStyle:"italic",marginBottom:2,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{hn}</div>}
            {dayTasks.slice(0,2).map((t,i)=><div key={i} style={{marginBottom:2}}><ClientBadge cliente={t.cliente}/></div>)}
            {dayTasks.length>2&&<div style={{fontSize:10}}>+{dayTasks.length-2}</div>}
          </div>;
        })}
      </div>
    </div>}

    {/* Tarefas */}
    {view==="tarefas"&&<div style={{padding:"20px"}}>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <input placeholder="Buscar..." value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})} style={{...inp,width:160}}/>
        {[{k:"cliente",opts:["Todos",...nomes.clientes]},{k:"area",opts:["Todas",...nomes.areas]},{k:"responsavel",opts:["Todos",...nomes.responsaveis]},{k:"status",opts:STATUS_F},{k:"tipo",opts:["Todos","mensal","anual"]}].map(f=><select key={f.k} value={filters[f.k]} onChange={e=>setFilters({...filters,[f.k]:e.target.value})} style={{...inp,width:"auto"}}>{f.opts.map(o=><option key={o}>{o}</option>)}</select>)}
        <button onClick={()=>setShowAdd(true)} style={{marginLeft:"auto",padding:"6px 14px",fontSize:13,borderRadius:7,border:"none",background:C.primary,color:"#fff",cursor:"pointer",fontWeight:600}}>+ Nova tarefa</button>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
        <div style={{fontSize:12}}>{filtered.length} tarefa(s)</div>
        {selected.length>0&&<button onClick={()=>setShowConfirmDel(true)} style={{padding:"5px 14px",fontSize:12,borderRadius:6,border:`1px solid ${C.red}`,background:C.redBg,color:"#000",cursor:"pointer",fontWeight:600}}>🗑 Excluir {selected.length} selecionada(s)</button>}
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,tableLayout:"fixed"}}>
          <colgroup><col style={{width:"3%"}}/><col style={{width:"20%"}}/><col style={{width:"8%"}}/><col style={{width:"8%"}}/><col style={{width:"10%"}}/><col style={{width:"8%"}}/><col style={{width:"8%"}}/><col style={{width:"8%"}}/><col style={{width:"7%"}}/><col style={{width:"8%"}}/><col style={{width:"8%"}}/><col style={{width:"4%"}}/></colgroup>
          <thead><tr style={{background:C.primary4}}>
            <th style={{...thS,padding:"9px 6px"}}><input type="checkbox" checked={selected.length===filtered.length&&filtered.length>0} onChange={toggleSelectAll}/></th>
            {["Atividade","Cliente","Área","Status","Tipo","Responsável","Data estimada","Data execução","Obs","Ações"].map(h=><th key={h} style={thS}>{h}</th>)}
          </tr></thead>
          <tbody>{filtered.map((t,idx)=><tr key={t.id} style={{...tdS(idx),background:selected.includes(t.id)?"#FFF0EB":idx%2===0?"#fff":"#fafafa"}}>
            <td style={{padding:"8px 6px",textAlign:"center"}}><input type="checkbox" checked={selected.includes(t.id)} onChange={()=>toggleSelect(t.id)}/></td>
            <td style={{padding:"8px 8px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={t.atividade}>{t.atividade}</td>
            <td style={{padding:"8px 6px"}}><ClientBadge cliente={t.cliente}/></td>
            <td style={{padding:"8px 6px"}}><AreaBadge area={t.area} areaColors={areaColors}/></td>
            <td style={{padding:"8px 6px"}}><Badge status={t.status}/></td>
            <td style={{padding:"8px 6px"}}><TipoBadge tipo={t.tipo}/></td>
            <td style={{padding:"8px 6px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.responsavel||<span style={{color:C.primary3,fontSize:11}}>—</span>}</td>
            <td style={{padding:"8px 6px"}}>{fmtDate(t.dataEstimada)}</td>
            <td style={{padding:"8px 6px"}}>{fmtDate(t.dataExecucao)}</td>
            <td style={{padding:"8px 6px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={t.obs}>{t.obs||"-"}</td>
            <td style={{padding:"8px 4px"}}>
              <button onClick={()=>setEditTask({...t})} style={{border:`1px solid ${C.primary3}`,background:C.primary4,cursor:"pointer",color:C.primary,fontSize:11,padding:"2px 5px",borderRadius:5,marginRight:2}}>✏️</button>
              <button onClick={()=>abrirHistorico(t)} style={{border:"none",background:"transparent",cursor:"pointer",color:C.gray,fontSize:11,padding:"2px 3px"}}>📋</button>
            </td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>}

    {/* Padrões */}
    {view==="padrao"&&<div style={{padding:"20px"}}>
      <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{fontSize:14,fontWeight:600}}>Tabela padrão de prazos</div>
        <div style={{marginLeft:"auto",display:"flex",gap:8,flexWrap:"wrap"}}>
          <select value={padraoFiltro} onChange={e=>setPadraoFiltro(e.target.value)} style={{...inp,width:"auto"}}>{["Todos",...nomes.clientes].map(c=><option key={c}>{c}</option>)}</select>
          <select value={padraoTipoFiltro} onChange={e=>setPadraoTipoFiltro(e.target.value)} style={{...inp,width:"auto"}}>{["Todos","mensal","anual"].map(c=><option key={c}>{c}</option>)}</select>
          <button onClick={baixarModeloExcel} style={{padding:"6px 12px",fontSize:13,borderRadius:7,border:`1.5px solid ${C.primary3}`,background:"transparent",color:C.primary,cursor:"pointer",fontWeight:500}}>📥 Baixar modelo Excel</button>
          <label style={{padding:"6px 12px",fontSize:13,borderRadius:7,border:`1.5px solid ${C.primary3}`,background:"transparent",color:C.primary,cursor:"pointer",fontWeight:500}}>
            📤 Importar Excel
            <input type="file" accept=".xlsx,.xls" onChange={handleImportarExcel} style={{display:"none"}}/>
          </label>
          <button onClick={()=>setShowImportar(true)} style={{padding:"6px 12px",fontSize:13,borderRadius:7,border:`1.5px solid ${C.primary3}`,background:"transparent",color:C.primary,cursor:"pointer",fontWeight:500}}>📋 Importar manual</button>
          <button onClick={()=>setShowAddPadrao(true)} style={{padding:"6px 14px",fontSize:13,borderRadius:7,border:"none",background:C.primary,color:"#fff",cursor:"pointer",fontWeight:600}}>+ Novo padrão</button>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
        <div style={{fontSize:12}}>{padraoFiltrado.length} padrão(ões)</div>
        {selectedPadrao.length>0&&<button onClick={()=>setShowConfirmDelPadrao(true)} style={{padding:"5px 14px",fontSize:12,borderRadius:6,border:`1px solid ${C.red}`,background:C.redBg,color:"#000",cursor:"pointer",fontWeight:600}}>🗑 Excluir {selectedPadrao.length} selecionado(s)</button>}
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,tableLayout:"fixed"}}>
          <colgroup><col style={{width:"3%"}}/><col style={{width:"22%"}}/><col style={{width:"10%"}}/><col style={{width:"9%"}}/><col style={{width:"9%"}}/><col style={{width:"8%"}}/><col style={{width:"8%"}}/><col style={{width:"8%"}}/><col style={{width:"9%"}}/><col style={{width:"7%"}}/><col style={{width:"7%"}}/></colgroup>
          <thead><tr style={{background:C.primary4}}>
            <th style={{...thS,padding:"9px 6px"}}><input type="checkbox" checked={selectedPadrao.length===padraoFiltrado.length&&padraoFiltrado.length>0} onChange={toggleSelectAllPadrao}/></th>
            {["Atividade","Cliente","Área","Responsável","Tipo","Prazo","Dia","Mês (anual)","Se não útil",""].map(h=><th key={h} style={thS}>{h}</th>)}
          </tr></thead>
          <tbody>{padraoFiltrado.map((p,idx)=><tr key={p.id} style={{...tdS(idx),background:selectedPadrao.includes(p.id)?"#FFF0EB":idx%2===0?"#fff":"#fafafa"}}>
            <td style={{padding:"8px 6px",textAlign:"center"}}><input type="checkbox" checked={selectedPadrao.includes(p.id)} onChange={()=>toggleSelectPadrao(p.id)}/></td>
            <td style={{padding:"8px 10px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={p.atividade}>{p.atividade}</td>
            <td style={{padding:"8px 6px"}}><ClientBadge cliente={p.cliente}/></td>
            <td style={{padding:"8px 6px"}}><AreaBadge area={p.area} areaColors={areaColors}/></td>
            <td style={{padding:"8px 6px"}}>{p.responsavel||"-"}</td>
            <td style={{padding:"8px 6px"}}><TipoBadge tipo={p.tipo}/></td>
            <td style={{padding:"8px 6px"}}><span style={{background:C.primary4,color:"#000",borderRadius:4,padding:"2px 6px",fontSize:10,fontWeight:600,border:`1px solid ${C.primary3}`}}>{p.tipoPrazo==="util"?"Dia útil":"Dia fixo"}</span></td>
            <td style={{padding:"8px 6px"}}>{p.tipoPrazo==="util"?`${p.dia}º dia útil`:`Dia ${p.dia}`}</td>
            <td style={{padding:"8px 6px",fontSize:11}}>{p.tipo==="anual"?(p.mes?MONTHS[p.mes-1]:"—"):"-"}</td>
            <td style={{padding:"8px 6px"}}><span style={{background:p.seNaoUtil==="recuar"?C.redBg:C.greenBg,color:"#000",borderRadius:4,padding:"2px 6px",fontSize:10,fontWeight:600}}>{p.seNaoUtil==="recuar"?"↩ Recuar":"↪ Avançar"}</span></td>
            <td style={{padding:"8px 6px"}}><button onClick={()=>setEditPadrao({...p})} style={{border:`1px solid ${C.primary3}`,background:C.primary4,cursor:"pointer",color:C.primary,fontSize:11,padding:"3px 8px",borderRadius:5,fontWeight:500}}>Editar</button></td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>}

    {/* Configurações */}
    {view==="configuracoes"&&<div style={{padding:"20px",maxWidth:700}}>
      <div style={{fontSize:16,fontWeight:700,marginBottom:24}}>⚙️ Configurações</div>
      <ConfigSection title="👤 Responsáveis" items={responsaveis} onAdd={addResp} onEdit={saveResp} onDelete={delResp} newItem={newResp} setNewItem={setNewResp} editItem={editResp} setEditItem={setEditResp} placeholder="Nome do responsável"/>
      <ConfigSection title="🏢 Clientes" items={clientes} onAdd={addCli} onEdit={saveCli} onDelete={delCli} newItem={newCli} setNewItem={setNewCli} editItem={editCli} setEditItem={setEditCli} placeholder="Nome do cliente"/>
      <ConfigSection title="📁 Áreas" items={areas} onAdd={addAreaItem} onEdit={saveAreaItem} onDelete={delAreaItem} newItem={newArea} setNewItem={setNewArea} editItem={editAreaItem} setEditItem={setEditAreaItem} placeholder="Nome da área"/>
    </div>}

    {/* Modais */}
    {showConfirmDel&&<Modal onClose={()=>setShowConfirmDel(false)} title="Confirmar exclusão" maxW={380}>
      <div style={{fontSize:14,marginBottom:16}}>Você está prestes a excluir <strong>{selected.length}</strong> tarefa(s). Esta ação não pode ser desfeita.</div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><BtnG onClick={()=>setShowConfirmDel(false)}>Cancelar</BtnG><BtnD onClick={handleDeleteEmLote}>{saving?"Excluindo...":"Excluir"}</BtnD></div>
    </Modal>}

    {showConfirmDelPadrao&&<Modal onClose={()=>setShowConfirmDelPadrao(false)} title="Confirmar exclusão" maxW={380}>
      <div style={{fontSize:14,marginBottom:16}}>Você está prestes a excluir <strong>{selectedPadrao.length}</strong> padrão(ões). Esta ação não pode ser desfeita.</div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><BtnG onClick={()=>setShowConfirmDelPadrao(false)}>Cancelar</BtnG><BtnD onClick={handleDeletePadraoEmLote}>{saving?"Excluindo...":"Excluir"}</BtnD></div>
    </Modal>}

    {showImportar&&<Modal onClose={()=>setShowImportar(false)} title="📥 Importar padrões em lote" maxW={960}>
      <div style={{fontSize:12,marginBottom:12}}>Preencha as linhas abaixo. Campos obrigatórios: Atividade, Cliente e Área.</div>
      <div style={{overflowX:"auto",marginBottom:12}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead><tr style={{background:C.primary4}}>{["Atividade","Cliente","Área","Responsável","Tipo","Prazo","Dia","Mês (anual)","Se não útil","Recorrência",""].map(h=><th key={h} style={{...thS,fontSize:10,padding:"6px 6px"}}>{h}</th>)}</tr></thead>
          <tbody>{importarLinhas.map((l,i)=><tr key={i} style={{borderBottom:`0.5px solid ${C.primary5}`}}>
            <td style={{padding:"4px"}}><input value={l.atividade} onChange={e=>updateLinhaImportar(i,"atividade",e.target.value)} style={{...inp,fontSize:11,padding:"4px 6px"}}/></td>
            <td style={{padding:"4px"}}><select value={l.cliente} onChange={e=>updateLinhaImportar(i,"cliente",e.target.value)} style={{...inp,fontSize:11,padding:"4px 6px"}}><option value="">—</option>{nomes.clientes.map(c=><option key={c}>{c}</option>)}</select></td>
            <td style={{padding:"4px"}}><select value={l.area} onChange={e=>updateLinhaImportar(i,"area",e.target.value)} style={{...inp,fontSize:11,padding:"4px 6px"}}><option value="">—</option>{nomes.areas.map(a=><option key={a}>{a}</option>)}</select></td>
            <td style={{padding:"4px"}}><select value={l.responsavel} onChange={e=>updateLinhaImportar(i,"responsavel",e.target.value)} style={{...inp,fontSize:11,padding:"4px 6px"}}><option value="">—</option>{nomes.responsaveis.map(r=><option key={r}>{r}</option>)}</select></td>
            <td style={{padding:"4px"}}><select value={l.tipo} onChange={e=>updateLinhaImportar(i,"tipo",e.target.value)} style={{...inp,fontSize:11,padding:"4px 6px"}}><option value="mensal">Mensal</option><option value="anual">Anual</option></select></td>
            <td style={{padding:"4px"}}><select value={l.tipoPrazo} onChange={e=>updateLinhaImportar(i,"tipoPrazo",e.target.value)} style={{...inp,fontSize:11,padding:"4px 6px"}}><option value="fixo">Fixo</option><option value="util">Útil</option></select></td>
            <td style={{padding:"4px"}}><input type="number" min="1" max="31" value={l.dia} onChange={e=>updateLinhaImportar(i,"dia",Number(e.target.value))} style={{...inp,fontSize:11,padding:"4px 6px",width:50}}/></td>
            <td style={{padding:"4px"}}><select value={l.mes??""} onChange={e=>updateLinhaImportar(i,"mes",e.target.value?Number(e.target.value):null)} style={{...inp,fontSize:11,padding:"4px 6px"}} disabled={l.tipo!=="anual"}><option value="">—</option>{MONTHS.map((m,mi)=><option key={mi+1} value={mi+1}>{m}</option>)}</select></td>
            <td style={{padding:"4px"}}><select value={l.seNaoUtil} onChange={e=>updateLinhaImportar(i,"seNaoUtil",e.target.value)} style={{...inp,fontSize:11,padding:"4px 6px"}}><option value="recuar">↩</option><option value="avancar">↪</option></select></td>
            <td style={{padding:"4px"}}><select value={l.recorrenciaAnual?"sim":"nao"} onChange={e=>updateLinhaImportar(i,"recorrenciaAnual",e.target.value==="sim")} style={{...inp,fontSize:11,padding:"4px 6px"}} disabled={l.tipo!=="anual"}><option value="nao">Única</option><option value="sim">Anual</option></select></td>
            <td style={{padding:"4px"}}><button onClick={()=>removeLinhaImportar(i)} style={{border:"none",background:"transparent",cursor:"pointer",color:C.red,fontSize:14}}>✕</button></td>
          </tr>)}</tbody>
        </table>
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"space-between",alignItems:"center"}}>
        <button onClick={addLinhaImportar} style={{padding:"6px 14px",fontSize:12,borderRadius:6,border:`1px solid ${C.primary3}`,background:C.primary4,color:C.primary,cursor:"pointer"}}>+ Adicionar linha</button>
        <div style={{display:"flex",gap:8}}><BtnG onClick={()=>setShowImportar(false)}>Cancelar</BtnG><BtnP onClick={handleImportarPadroes}>{saving?"Importando...":"Importar padrões"}</BtnP></div>
      </div>
    </Modal>}

    {modalCal&&<Modal onClose={()=>{setModalCal(null);setEditCalTask(null);}} title={`📅 ${modalCal.day}/${String(calMonth+1).padStart(2,"0")}/${calYear}${modalCal.holName?" — 🎉 "+modalCal.holName:""}`} maxW={520}>
      {modalCal.holName&&<div style={{background:C.primary5,border:`1px solid ${C.primary3}`,borderRadius:8,padding:"8px 12px",marginBottom:14,fontSize:12,fontWeight:500}}>🎉 Feriado: {modalCal.holName}</div>}
      {modalCal.tasks.length===0&&<div style={{fontSize:13}}>Nenhuma tarefa neste dia.</div>}
      {modalCal.tasks.map(t=><div key={t.id} style={{borderBottom:`0.5px solid ${C.primary3}`,paddingBottom:12,marginBottom:12}}>
        {editCalTask&&editCalTask.id===t.id?<div style={{background:"#fff",borderRadius:8,padding:"10px 12px",border:`1px solid ${C.primary3}`}}>
          <div style={{fontSize:12,fontWeight:600,marginBottom:8}}>{t.atividade}</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:120}}><Field label="Data execução"><input type="date" value={editCalTask.dataExecucao} onChange={e=>setEditCalTask({...editCalTask,dataExecucao:e.target.value})} style={inp}/></Field></div>
            <div style={{flex:1,minWidth:120}}><Field label="Responsável"><select value={editCalTask.responsavel} onChange={e=>setEditCalTask({...editCalTask,responsavel:e.target.value})} style={inp}><option value="">—</option>{nomes.responsaveis.map(o=><option key={o}>{o}</option>)}</select></Field></div>
            <div style={{flex:1,minWidth:120}}><Field label="Status"><select value={editCalTask.status} onChange={e=>setEditCalTask({...editCalTask,status:e.target.value})} style={inp}>{STATUS_LIST.map(o=><option key={o}>{o}</option>)}</select></Field></div>
          </div>
          <div style={{display:"flex",gap:8,marginTop:10,justifyContent:"flex-end"}}><BtnG onClick={()=>setEditCalTask(null)}>Cancelar</BtnG><BtnP onClick={saveCalTask}>{saving?"Salvando...":"Salvar"}</BtnP></div>
        </div>:<>
          <div style={{fontSize:13,fontWeight:600,marginBottom:6}}>{t.atividade}</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:4}}><ClientBadge cliente={t.cliente}/><AreaBadge area={t.area} areaColors={areaColors}/><Badge status={t.status}/><TipoBadge tipo={t.tipo}/></div>
          <div style={{fontSize:11,marginBottom:4}}>👤 {t.responsavel||"— a definir"}</div>
          {t.dataExecucao&&<div style={{fontSize:11}}>✅ Executado: {fmtDate(t.dataExecucao)}</div>}
          <button onClick={()=>setEditCalTask({...t})} style={{marginTop:6,border:`1px solid ${C.primary3}`,background:C.primary4,cursor:"pointer",color:C.primary,fontSize:11,padding:"3px 10px",borderRadius:5,fontWeight:500}}>Registrar execução</button>
        </>}
      </div>)}
    </Modal>}

    {showEscolhaMes&&<Modal onClose={()=>setShowEscolhaMes(false)} title="✦ Gerar tarefas mensais" maxW={360}>
      <Field label="Mês de referência"><input type="month" value={escolhaMes} onChange={e=>setEscolhaMes(e.target.value)} style={inp}/></Field>
      <p style={{fontSize:12,marginBottom:16}}>Serão geradas apenas as tarefas do tipo <strong>Mensal</strong>.</p>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><BtnG onClick={()=>setShowEscolhaMes(false)}>Cancelar</BtnG><BtnP onClick={()=>{setShowEscolhaMes(false);handleGerarPreview();}}>Ver prévia</BtnP></div>
    </Modal>}

    {showEscolhaAno&&<Modal onClose={()=>setShowEscolhaAno(false)} title="📆 Gerar tarefas anuais" maxW={360}>
      <Field label="Ano de referência"><input type="number" min="2024" max="2050" value={escolhaAno} onChange={e=>setEscolhaAno(e.target.value)} style={inp}/></Field>
      <p style={{fontSize:12,marginBottom:16}}>Serão geradas as tarefas do tipo <strong>Anual</strong> como 13º, PLR, reajustes etc., usando o mês definido em cada padrão.</p>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><BtnG onClick={()=>setShowEscolhaAno(false)}>Cancelar</BtnG><BtnP onClick={()=>{setShowEscolhaAno(false);handleGerarAnualPreview();}}>Ver prévia</BtnP></div>
    </Modal>}

    {showGerar&&gerarMes&&<div onClick={()=>setShowGerar(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.primary4,borderRadius:14,border:`1.5px solid ${C.primary3}`,padding:0,maxWidth:700,width:"96%",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{background:`linear-gradient(135deg,${C.primary},${C.navy})`,borderRadius:"12px 12px 0 0",padding:"13px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontWeight:600,fontSize:14,color:"#fff"}}>✦ Prévia mensal — {MONTHS[gerarMes.mes]} {gerarMes.ano}</span>
          <button onClick={()=>setShowGerar(false)} style={{border:"none",background:"rgba(255,255,255,0.2)",cursor:"pointer",fontSize:15,color:"#fff",width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>
        <div style={{padding:"16px 20px"}}>
          <div style={{fontSize:12,marginBottom:12,background:C.primary5,borderRadius:7,padding:"9px 14px",border:`1px solid ${C.primary3}`}}>{gerarPreview.length} tarefas mensais.{gerarPreview.some(p=>p.adjusted)&&" 🔶 = data ajustada."}</div>
          <div style={{overflowX:"auto",marginBottom:16}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr style={{background:C.primary5}}>{["Atividade","Cliente","Área","Data estimada","Ajuste manual"].map(h=><th key={h} style={{textAlign:"left",padding:"7px 10px",fontWeight:600,fontSize:11,borderBottom:`1px solid ${C.primary3}`}}>{h}</th>)}</tr></thead>
              <tbody>{gerarPreview.map((p,i)=><tr key={i} style={{borderBottom:`0.5px solid ${C.primary5}`,background:i%2===0?"#fff":C.primary4}}>
                <td style={{padding:"6px 10px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:180}} title={p.atividade}>{p.atividade}</td>
                <td style={{padding:"6px 8px"}}><ClientBadge cliente={p.cliente}/></td>
                <td style={{padding:"6px 8px"}}><AreaBadge area={p.area} areaColors={areaColors}/></td>
                <td style={{padding:"6px 10px",fontWeight:600}}>{fmtDate(p.dataEstimada)}{p.adjusted&&<span style={{marginLeft:4,color:C.primary}}>🔶</span>}</td>
                <td style={{padding:"6px 8px"}}><input type="date" value={p.dataEstimada} onChange={e=>{const u=[...gerarPreview];u[i]={...u[i],dataEstimada:e.target.value,adjusted:false};setGerarPreview(u);}} style={{...inp,padding:"3px 6px",fontSize:11,width:"130px"}}/></td>
              </tr>)}</tbody>
            </table>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><BtnG onClick={()=>setShowGerar(false)}>Cancelar</BtnG><BtnP onClick={handleConfirmarGerar}>{saving?"Criando...":"Confirmar e criar"}</BtnP></div>
        </div>
      </div>
    </div>}

    {showGerarAnual&&gerarAnualAno&&<div onClick={()=>setShowGerarAnual(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.primary4,borderRadius:14,border:`1.5px solid ${C.primary3}`,padding:0,maxWidth:700,width:"96%",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{background:`linear-gradient(135deg,${C.primary},${C.navy})`,borderRadius:"12px 12px 0 0",padding:"13px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontWeight:600,fontSize:14,color:"#fff"}}>📆 Prévia anual — {gerarAnualAno}</span>
          <button onClick={()=>setShowGerarAnual(false)} style={{border:"none",background:"rgba(255,255,255,0.2)",cursor:"pointer",fontSize:15,color:"#fff",width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>
        <div style={{padding:"16px 20px"}}>
          <div style={{fontSize:12,marginBottom:12,background:C.primary5,borderRadius:7,padding:"9px 14px",border:`1px solid ${C.primary3}`}}>{gerarAnualPreview.length} tarefas anuais. Ajuste as datas conforme necessário antes de confirmar.</div>
          <div style={{overflowX:"auto",marginBottom:16}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr style={{background:C.primary5}}>{["Atividade","Cliente","Mês/Recorrência","Data estimada","Ajuste manual"].map(h=><th key={h} style={{textAlign:"left",padding:"7px 10px",fontWeight:600,fontSize:11,borderBottom:`1px solid ${C.primary3}`}}>{h}</th>)}</tr></thead>
              <tbody>{gerarAnualPreview.map((p,i)=><tr key={i} style={{borderBottom:`0.5px solid ${C.primary5}`,background:i%2===0?"#fff":C.primary4}}>
                <td style={{padding:"6px 10px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:180}} title={p.atividade}>{p.atividade}</td>
                <td style={{padding:"6px 8px"}}><ClientBadge cliente={p.cliente}/></td>
                <td style={{padding:"6px 8px"}}><span style={{fontSize:10,fontWeight:600,color:p.recorrenciaAnual?"#3B6D11":"#854F0B"}}>{p.mes?MONTHS[p.mes-1]:"—"} {p.recorrenciaAnual?"🔄":"1x"}</span></td>
                <td style={{padding:"6px 10px",fontWeight:600}}>{fmtDate(p.dataEstimada)}</td>
                <td style={{padding:"6px 8px"}}><input type="date" value={p.dataEstimada} onChange={e=>{const u=[...gerarAnualPreview];u[i]={...u[i],dataEstimada:e.target.value};setGerarAnualPreview(u);}} style={{...inp,padding:"3px 6px",fontSize:11,width:"130px"}}/></td>
              </tr>)}</tbody>
            </table>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><BtnG onClick={()=>setShowGerarAnual(false)}>Cancelar</BtnG><BtnP onClick={handleConfirmarGerarAnual}>{saving?"Criando...":"Confirmar e criar"}</BtnP></div>
        </div>
      </div>
    </div>}

    {showHistorico&&<Modal onClose={()=>setShowHistorico(null)} title={`📋 Histórico — ${showHistorico.atividade}`} maxW={540}>
      {historico.length===0?<div style={{fontSize:13}}>Nenhuma alteração registrada.</div>:
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead><tr style={{borderBottom:`1px solid ${C.primary3}`}}>{["Data/Hora","Campo","Antes","Depois"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 8px",fontWeight:600,fontSize:11}}>{h}</th>)}</tr></thead>
        <tbody>{historico.map(h=><tr key={h.id} style={{borderBottom:`0.5px solid ${C.primary5}`}}>
          <td style={{padding:"6px 8px",fontSize:11}}>{new Date(h.created_at).toLocaleString("pt-BR")}</td>
          <td style={{padding:"6px 8px",fontWeight:500}}>{h.campo}</td>
          <td style={{padding:"6px 8px",color:C.red}}>{h.valor_antes||"-"}</td>
          <td style={{padding:"6px 8px",color:C.green}}>{h.valor_depois||"-"}</td>
        </tr>)}</tbody>
      </table>}
    </Modal>}

    {showFeriados&&<Modal onClose={()=>setShowFeriados(false)} title="📅 Feriados estaduais e municipais" maxW={520}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,marginBottom:16}}>
        <thead><tr style={{borderBottom:`1px solid ${C.primary3}`}}>{["Data","Nome",""].map(h=><th key={h} style={{textAlign:"left",padding:"6px 8px",fontWeight:600,fontSize:11}}>{h}</th>)}</tr></thead>
        <tbody>{[...feriados].sort((a,b)=>a.data>b.data?1:-1).map(f=><tr key={f.id} style={{borderBottom:`0.5px solid ${C.primary5}`}}>
          <td style={{padding:"6px 8px",fontWeight:500}}>{fmtDate(f.data)}</td>
          <td style={{padding:"6px 8px"}}>{f.nome}</td>
          <td><button onClick={()=>setEditFeriado({...f})} style={{border:`1px solid ${C.primary3}`,background:C.primary4,cursor:"pointer",color:C.primary,fontSize:11,padding:"2px 8px",borderRadius:5}}>Editar</button></td>
        </tr>)}</tbody>
      </table>
      <div style={{borderTop:`1px solid ${C.primary3}`,paddingTop:14}}>
        <div style={{fontSize:12,fontWeight:600,marginBottom:10}}>Adicionar feriado</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-end"}}>
          <div style={{flex:"0 0 140px"}}><Field label="Data"><input type="date" value={newFeriado.data} onChange={e=>setNewFeriado({...newFeriado,data:e.target.value})} style={inp}/></Field></div>
          <div style={{flex:1,minWidth:140}}><Field label="Nome"><input value={newFeriado.nome} onChange={e=>setNewFeriado({...newFeriado,nome:e.target.value})} placeholder="Ex: Aniversário de Campo Grande" style={inp}/></Field></div>
          <BtnP onClick={addFeriado} disabled={!newFeriado.data||!newFeriado.nome}>+ Adicionar</BtnP>
        </div>
      </div>
    </Modal>}

    {editFeriado&&<Modal onClose={()=>setEditFeriado(null)} title="Editar feriado"><Field label="Data"><input type="date" value={editFeriado.data} onChange={e=>setEditFeriado({...editFeriado,data:e.target.value})} style={inp}/></Field><Field label="Nome"><input value={editFeriado.nome} onChange={e=>setEditFeriado({...editFeriado,nome:e.target.value})} style={inp}/></Field><div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:16}}><BtnD onClick={()=>handleDeleteFeriado(editFeriado.id)}>Excluir</BtnD><BtnP onClick={saveFeriado}>Salvar</BtnP></div></Modal>}
    {editTask&&<Modal onClose={()=>setEditTask(null)} title="Editar tarefa">{TF(editTask,setEditTask)}<div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:16}}><BtnD onClick={()=>handleDeleteTask(editTask.id)}>Excluir</BtnD><BtnP onClick={saveEdit}>{saving?"Salvando...":"Salvar"}</BtnP></div></Modal>}
    {showAdd&&<Modal onClose={()=>setShowAdd(false)} title="Nova tarefa">{TF(newTask,setNewTask)}<div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}><BtnP onClick={addTask} disabled={!newTask.atividade}>{saving?"Adicionando...":"Adicionar"}</BtnP></div></Modal>}
    {editPadrao&&<Modal onClose={()=>setEditPadrao(null)} title="Editar padrão">{PF(editPadrao,setEditPadrao)}<div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:16}}><BtnD onClick={()=>handleDeletePadrao(editPadrao.id)}>Excluir</BtnD><BtnP onClick={savePadrao}>Salvar</BtnP></div></Modal>}
    {showAddPadrao&&<Modal onClose={()=>{setShowAddPadrao(false);setReplicarTodos(false);}} title="Novo padrão">
      {PF(newPadrao,setNewPadrao)}
      <div style={{borderTop:`1px solid ${C.primary3}`,marginTop:12,paddingTop:12}}>
        <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",fontSize:13,fontWeight:500,color:"#000"}}>
          <input type="checkbox" checked={replicarTodos} onChange={e=>setReplicarTodos(e.target.checked)} style={{width:16,height:16,accentColor:C.primary}}/>
          <span>🔁 Replicar para <strong>todos os clientes</strong> cadastrados (responsável ficará em branco)</span>
        </label>
        {replicarTodos&&<div style={{marginTop:8,fontSize:12,color:C.dark,background:C.primary5,borderRadius:6,padding:"8px 12px"}}>
          Serão criados <strong>{nomes.clientes.length}</strong> padrão(ões) — um para cada cliente: {nomes.clientes.join(", ")}
        </div>}
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}>
        <BtnP onClick={addPadrao} disabled={!newPadrao.atividade}>{saving?"Salvando...":"Adicionar"}</BtnP>
      </div>
    </Modal>}
  </div>;
}

"use client";

import { ChangeEvent, useEffect, useState } from "react";

type View = "today" | "plans" | "recovery" | "progress";
type Exercise = { name: string; muscle: string; sets: number; volume: number; unit?: string; paused?: boolean; note?: string };
type Template = { id: string; name: string; accent: string; exercises: Exercise[] };
type LoadMode = "total" | "sides";
type SetLog = { id: string; day: number; templateId: string; exercise: string; weight: number; loadMode?: LoadMode; leftWeight?: number; rightWeight?: number; reps: number; rir: number; createdAt: string };
type Recovery = { day: number; sleep: number; restingHr: number; hrv: number; workoutDuration: number; avgHr: number; fatigue: number; soreness: number; stress: number; pain: string };
type HealthMetric = { name?: string; data?: Array<{ qty?: number; date?: string; start?: string; startDate?: string; value?: string }> };
type HealthExport = { data?: { metrics?: HealthMetric[]; workouts?: Array<{ name?: string; start?: string; end?: string; duration?: number; avgHeartRate?: { qty?: number } }> } };

const templates: Template[] = [
  { id: "shoulder", name: "肩", accent: "青绿", exercises: [
    { name:"阿诺德推肩", muscle:"肩", sets:5, volume:755 }, { name:"杠铃提拉", muscle:"肩", sets:4, volume:780, note:"记录肩部感受" },
    { name:"侧平举", muscle:"肩", sets:4, volume:480 }, { name:"俯身飞鸟", muscle:"肩后束", sets:4, volume:480 },
    { name:"面拉", muscle:"肩后束", sets:4, volume:1620 }, { name:"前平举", muscle:"肩前束", sets:4, volume:240 },
  ]},
  { id: "arms", name: "臂膀", accent: "珊瑚", exercises: [
    { name:"杠铃弯举", muscle:"肱二头", sets:5, volume:930 }, { name:"绳索臂屈伸", muscle:"肱三头", sets:5, volume:1040 },
    { name:"绳索弯举", muscle:"肱二头", sets:4, volume:1140 }, { name:"哑铃臂屈伸", muscle:"肱三头", sets:4, volume:480, note:"截图形态为俯身臂屈伸" },
    { name:"锤式弯举", muscle:"肱二头", sets:4, volume:480 }, { name:"坐姿腿屈伸", muscle:"股四头", sets:4, volume:1080, paused:true, note:"与你“不做下肢力量”边界冲突" },
  ]},
  { id: "back", name: "背", accent: "靛蓝", exercises: [
    { name:"引体向上（辅助）", muscle:"背", sets:5, volume:355, note:"记录辅助重量" }, { name:"宽距下拉", muscle:"背", sets:5, volume:1210 },
    { name:"拉杆坐姿划船（宽握）", muscle:"背", sets:4, volume:1740 }, { name:"坐姿划船", muscle:"背", sets:4, volume:1740, note:"记录器械及握法" },
    { name:"山羊挺身", muscle:"竖脊肌", sets:4, volume:240 },
  ]},
  { id: "abs", name: "腹肌", accent: "金黄", exercises: [
    { name:"3/4 仰卧起坐", muscle:"腹肌", sets:4, volume:80, unit:"次", note:"截图总计 80 次" }, { name:"死虫", muscle:"核心", sets:1, volume:0, unit:"待记录" },
    { name:"平板支撑触脚尖", muscle:"核心", sets:1, volume:0, unit:"待记录" }, { name:"保护式卷腹", muscle:"腹肌", sets:1, volume:0, unit:"待记录" },
  ]},
];

const nav: { id: View; short: string; label: string }[] = [
  { id:"today", short:"今", label:"今日" }, { id:"plans", short:"划", label:"计划" },
  { id:"recovery", short:"复", label:"恢复" }, { id:"progress", short:"势", label:"趋势" },
];

const initialRecovery: Recovery = { day:1, sleep:7, restingHr:72, hrv:30, workoutDuration:0, avgHr:0, fatigue:4, soreness:2, stress:4, pain:"无" };

export default function Home() {
  const [view, setView] = useState<View>("today");
  const [templateId, setTemplateId] = useState("shoulder");
  const [day, setDay] = useState(1);
  const [logs, setLogs] = useState<SetLog[]>([]);
  const [recovery, setRecovery] = useState<Recovery>(initialRecovery);
  const [lastHealthImport, setLastHealthImport] = useState("");
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  /* This one-time effect intentionally hydrates browser-only local storage and Shortcut data. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const stored = localStorage.getItem("muscle-coach-workbench-v1");
      let nextRecovery = initialRecovery;
      if (stored) {
        const parsed = JSON.parse(stored);
        setLogs(parsed.logs || []); nextRecovery = { ...initialRecovery, ...(parsed.recovery || {}) }; setDay(parsed.day || 1); setTemplateId(parsed.templateId || "shoulder"); setLastHealthImport(parsed.lastHealthImport || "");
      }
      const fragment = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
      const params = new URLSearchParams(fragment || window.location.search);
      if (params.get("health") === "1") {
        const read = (key:string, min:number, max:number) => { const value = Number(params.get(key)); return Number.isFinite(value) && value >= min && value <= max ? value : undefined; };
        nextRecovery = { ...nextRecovery, sleep:read("sleep",0,15) ?? nextRecovery.sleep, restingHr:read("rhr",30,220) ?? nextRecovery.restingHr, hrv:read("hrv",0,300) ?? nextRecovery.hrv, workoutDuration:read("duration",0,600) ?? nextRecovery.workoutDuration, avgHr:read("avgHr",30,240) ?? nextRecovery.avgHr };
        setLastHealthImport(new Date().toISOString()); setSaved(true); window.setTimeout(()=>setSaved(false),1800); window.history.replaceState({},"",window.location.pathname);
      }
      setRecovery(nextRecovery);
    } catch { /* keep safe defaults */ }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("muscle-coach-workbench-v1", JSON.stringify({ logs, recovery, day, templateId, lastHealthImport }));
  }, [logs, recovery, day, templateId, lastHealthImport, hydrated]);

  const selected = templates.find((item) => item.id === templateId) || templates[0];
  const activeExercises = selected.exercises.filter((item) => !item.paused);
  const plannedSets = activeExercises.reduce((sum, item) => sum + item.sets, 0);
  const todayLogs = logs.filter((item) => item.day === day && item.templateId === templateId);
  const completion = plannedSets ? Math.min(100, Math.round(todayLogs.length / plannedSets * 100)) : 0;
  const loggedLoad = (item: SetLog) => item.loadMode === "sides" ? (item.leftWeight || 0) + (item.rightWeight || 0) : item.weight;
  const totalVolume = logs.reduce((sum, item) => sum + loggedLoad(item) * item.reps, 0);
  const coach = recovery.pain !== "无"
    ? { tone:"danger", title:"先暂停相关训练", text:"你记录了疼痛。不要用 HRV 覆盖疼痛信号；请停止诱发动作并说明部位与性质。" }
    : recovery.sleep < 6 || recovery.fatigue >= 8
      ? { tone:"warn", title:"今天保守执行", text:"恢复信号偏弱：负荷保持或降低一档，工作组保留 RIR 3，不追求截图中的历史容量。" }
      : { tone:"good", title:"可以按计划训练", text:"恢复状态没有明显异常。首组从偏轻负荷开始，最后一组记录 RIR，再决定下次是否进阶。" };

  function addSet(exercise: string, form: HTMLFormElement) {
    const data = new FormData(form);
    const loadMode = data.get("loadMode") as LoadMode;
    const weight = Number(data.get("weight")); const leftWeight = Number(data.get("leftWeight")); const rightWeight = Number(data.get("rightWeight")); const reps = Number(data.get("reps")); const rir = Number(data.get("rir"));
    const validLoad = loadMode === "sides"
      ? Number.isFinite(leftWeight) && leftWeight >= 0 && Number.isFinite(rightWeight) && rightWeight >= 0
      : Number.isFinite(weight) && weight >= 0;
    if (!validLoad || !Number.isFinite(reps) || reps < 1 || !Number.isFinite(rir) || rir < 0 || rir > 5) return;
    setLogs((current) => [...current, { id:crypto.randomUUID(), day, templateId, exercise, weight: loadMode === "sides" ? leftWeight + rightWeight : weight, loadMode, leftWeight: loadMode === "sides" ? leftWeight : undefined, rightWeight: loadMode === "sides" ? rightWeight : undefined, reps, rir, createdAt:new Date().toISOString() }]);
    form.reset(); setSaved(true); window.setTimeout(() => setSaved(false), 1400);
  }

  function exportData() {
    const payload = { exportedAt:new Date().toISOString(), profile:{ age:27, sex:"女", heightCm:168, weightKg:58, goalWeightKg:53, lowerBodyStrength:false }, templates, logs, recovery };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type:"application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `增肌教练-第${day}天.json`; anchor.click(); URL.revokeObjectURL(url);
  }

  async function copyBridgeTemplate() {
    const currentPage = `${window.location.origin}${window.location.pathname}`;
    const template = `${currentPage}#health=1&sleep=【睡眠小时】&rhr=【静息心率】&hrv=【HRV】&duration=【训练分钟】&avgHr=【平均心率】`;
    await navigator.clipboard.writeText(template); setSaved(true); window.setTimeout(()=>setSaved(false),1600);
  }

  async function importHealthExport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text()) as HealthExport;
      const metrics = payload.data?.metrics || [];
      const metric = (name: string) => metrics.find((item) => item.name === name)?.data || [];
      const sortByDate = <T extends { date?: string; start?: string; startDate?: string }>(items: T[]) => [...items].sort((a, b) => new Date(b.date || b.start || b.startDate || 0).getTime() - new Date(a.date || a.start || a.startDate || 0).getTime());
      const latestValue = (name: string) => Number(sortByDate(metric(name))[0]?.qty);
      const sleepByNight = new Map<string, number>();
      for (const sample of metric("sleep_analysis")) {
        const value = sample.value || "";
        const hours = Number(sample.qty);
        const started = new Date(sample.start || sample.startDate || sample.date || 0);
        if (!Number.isFinite(hours) || hours <= 0 || !Number.isFinite(started.getTime()) || value.includes("清醒") || value.includes("卧床")) continue;
        const night = new Date(started);
        if (night.getHours() < 12) night.setDate(night.getDate() - 1);
        const key = `${night.getFullYear()}-${String(night.getMonth() + 1).padStart(2, "0")}-${String(night.getDate()).padStart(2, "0")}`;
        sleepByNight.set(key, (sleepByNight.get(key) || 0) + hours);
      }
      const latestSleep = [...sleepByNight.entries()].sort(([a], [b]) => b.localeCompare(a))[0]?.[1];
      const latestWorkout = [...(payload.data?.workouts || [])].sort((a, b) => new Date(b.end || b.start || 0).getTime() - new Date(a.end || a.start || 0).getTime())[0];
      setRecovery((current) => ({
        ...current,
        sleep: Number.isFinite(latestSleep) ? Number(latestSleep.toFixed(1)) : current.sleep,
        restingHr: Number.isFinite(latestValue("resting_heart_rate")) ? Math.round(latestValue("resting_heart_rate")) : current.restingHr,
        hrv: Number.isFinite(latestValue("heart_rate_variability")) ? Number(latestValue("heart_rate_variability").toFixed(1)) : current.hrv,
        workoutDuration: Number.isFinite(latestWorkout?.duration) ? Math.round((latestWorkout?.duration || 0) / 60) : current.workoutDuration,
        avgHr: Number.isFinite(latestWorkout?.avgHeartRate?.qty) ? Math.round(latestWorkout?.avgHeartRate?.qty || 0) : current.avgHr,
      }));
      setLastHealthImport(new Date().toISOString()); setSaved(true); window.setTimeout(() => setSaved(false), 1800);
    } catch {
      window.alert("无法读取该文件。请选择 Health Auto Export 导出的 JSON 文件。");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <main className="shell">
      <aside className="rail">
        <div className="brandMark">增</div>
        <nav aria-label="主导航">{nav.map((item) => <button key={item.id} className={`railButton ${view===item.id?"active":""}`} onClick={()=>setView(item.id)} aria-label={item.label}><b>{item.short}</b><small>{item.label}</small></button>)}</nav>
        <button className="exportButton" onClick={exportData} aria-label="导出数据">导出</button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">14 天试运行 · DAY {day}</p><h1>{view === "today" ? `今天练${selected.name}。` : view === "plans" ? "你的四套训练模板" : view === "recovery" ? "恢复打卡" : "14 天训练趋势"}</h1></div>
          <label className="dayPicker">第 <select value={day} onChange={(event)=>setDay(Number(event.target.value))}>{Array.from({length:14},(_,i)=><option key={i+1}>{i+1}</option>)}</select> 天</label>
        </header>

        {view === "today" && <div className="dashboardGrid">
          <section className="mainColumn">
            <article className="heroCard">
              <div className="heroTop"><div><p className="label">今日处方</p><div className="titleLine"><h2>{selected.name}</h2><select className="templateSelect" value={templateId} onChange={(e)=>setTemplateId(e.target.value)}>{templates.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></div><p className="muted">{plannedSets} 个可执行工作组 · {activeExercises.length} 个动作</p></div><div className="scoreRing" style={{"--score":`${completion*3.6}deg`} as React.CSSProperties}><strong>{completion}%</strong><small>完成率</small></div></div>
              <div className="exerciseCards">{selected.exercises.map((exercise,index)=>{
                const done = todayLogs.filter(log=>log.exercise===exercise.name).length;
                return <article className={`exerciseCard ${exercise.paused?"paused":""}`} key={exercise.name}>
                  <div className="exerciseHead"><span className="index">{String(index+1).padStart(2,"0")}</span><div><strong>{exercise.name}</strong><small>{exercise.muscle} · {exercise.sets}组 · 截图{exercise.unit || "容量"} {exercise.volume}</small></div><span className="setCount">{exercise.paused?"暂停":`${done}/${exercise.sets}`}</span></div>
                  {exercise.note && <p className="exerciseNote">{exercise.note}</p>}
                  {!exercise.paused && <SetForm exercise={exercise.name} onSubmit={addSet} />}
                </article>;
              })}</div>
            </article>
          </section>
          <aside className="sideStack">
            <article className={`coachCard ${coach.tone}`}><p className="label">教练判断</p><h3>{coach.title}</h3><p>{coach.text}</p></article>
            <article className="metricCard"><p className="label">恢复快照</p><div className="metric"><span>睡眠</span><strong>{recovery.sleep || "—"} h</strong></div><div className="metric"><span>静息心率</span><strong>{recovery.restingHr || "—"} bpm</strong></div><div className="metric"><span>HRV</span><strong>{recovery.hrv || "—"} ms</strong></div><div className="metric"><span>训练</span><strong>{recovery.workoutDuration || "—"} min</strong></div><div className="metric"><span>平均心率</span><strong>{recovery.avgHr || "—"} bpm</strong></div><button className="textButton" onClick={()=>setView("recovery")}>更新恢复数据 →</button></article>
            <article className="privacyCard"><strong>数据仅保存在这台设备</strong><p>不上传医疗记录、定位轨迹或无关健康数据。可随时导出 JSON 备份。</p></article>
          </aside>
        </div>}

        {view === "plans" && <section className="contentPanel"><div className="sectionIntro"><div><p className="label">计划库</p><h2>按你的训记模板原样录入</h2></div><p>容量是历史汇总，不是目标重量；目标次数和 RIR 由实际记录决定。</p></div><div className="templateGrid">{templates.map(template=>{const available=template.exercises.filter(e=>!e.paused).reduce((s,e)=>s+e.sets,0);return <article className="templateCard" key={template.id}><div className="templateTop"><span className={`templateBadge ${template.id}`}>{template.name.slice(0,1)}</span><div><h3>{template.name}</h3><p>{available} 个可执行组 · {template.exercises.filter(e=>!e.paused).length} 个动作</p></div></div><ol>{template.exercises.map(e=><li className={e.paused?"mutedRow":""} key={e.name}><span>{e.name}{e.paused&&"（暂停）"}</span><b>{e.sets}组</b></li>)}</ol><button onClick={()=>{setTemplateId(template.id);setView("today")}}>选择这个模板</button></article>})}</div></section>}

        {view === "recovery" && <section className="contentPanel narrow"><div className="sectionIntro"><div><p className="label">DAY {day}</p><h2>只记录影响训练的恢复字段</h2></div></div><article className="healthBridge"><div><p className="label">APPLE HEALTH BRIDGE</p><h3>{lastHealthImport ? "已收到健康数据" : "等待首次健康数据导入"}</h3><p>{lastHealthImport ? `最近导入：${new Date(lastHealthImport).toLocaleString("zh-CN")}` : "导入 Health Auto Export 的 JSON 后，睡眠、静息心率、HRV 与最近一次训练自动写入本机浏览器。"}</p></div><div className="bridgeActions"><label className="importButton">导入 Health JSON<input type="file" accept="application/json,.json" onChange={importHealthExport}/></label><button type="button" onClick={copyBridgeTemplate}>复制快捷指令网址</button></div></article><form className="recoveryForm" onSubmit={(e)=>{e.preventDefault();setSaved(true);setTimeout(()=>setSaved(false),1400)}}>
          <NumberField label="睡眠" unit="小时" value={recovery.sleep} min={0} max={15} step={0.1} onChange={v=>setRecovery({...recovery,day,sleep:v})}/>
          <NumberField label="静息心率" unit="bpm" value={recovery.restingHr} min={30} max={220} onChange={v=>setRecovery({...recovery,day,restingHr:v})}/>
          <NumberField label="HRV SDNN" unit="ms" value={recovery.hrv} min={0} max={300} onChange={v=>setRecovery({...recovery,day,hrv:v})}/>
          <NumberField label="训练时长" unit="分钟" value={recovery.workoutDuration} min={0} max={600} onChange={v=>setRecovery({...recovery,day,workoutDuration:v})}/>
          <NumberField label="训练平均心率" unit="bpm" value={recovery.avgHr} min={0} max={240} onChange={v=>setRecovery({...recovery,day,avgHr:v})}/>
          <NumberField label="疲劳" unit="1–10" value={recovery.fatigue} min={1} max={10} onChange={v=>setRecovery({...recovery,day,fatigue:v})}/>
          <NumberField label="酸痛" unit="0–10" value={recovery.soreness} min={0} max={10} onChange={v=>setRecovery({...recovery,day,soreness:v})}/>
          <NumberField label="压力" unit="1–10" value={recovery.stress} min={1} max={10} onChange={v=>setRecovery({...recovery,day,stress:v})}/>
          <label className="field wide"><span>疼痛类型</span><select value={recovery.pain} onChange={e=>setRecovery({...recovery,day,pain:e.target.value})}><option>无</option><option>普通酸痛</option><option>关节痛</option><option>锐痛</option><option>放射痛</option><option>其他</option></select></label>
          <button className="primary wide" type="submit">保存恢复打卡</button>
        </form><div className={`inlineCoach ${coach.tone}`}><strong>{coach.title}</strong><p>{coach.text}</p></div></section>}

        {view === "progress" && <section className="contentPanel"><div className="summaryCards"><article><span>已记录工作组</span><strong>{logs.length}</strong></article><article><span>累计训练容量</span><strong>{totalVolume.toFixed(0)}</strong><small>kg·次</small></article><article><span>当前提交天数</span><strong>{new Set(logs.map(l=>l.day)).size}</strong><small>/ 14</small></article></div><div className="timeline"><div className="sectionIntro"><div><p className="label">14 DAYS</p><h2>训练记录分布</h2></div></div><div className="dayGrid">{Array.from({length:14},(_,i)=>{const count=logs.filter(l=>l.day===i+1).length;return <button key={i+1} className={count?"logged":""} onClick={()=>{setDay(i+1);setView("today")}}><span>D{i+1}</span><strong>{count}</strong><small>组</small></button>})}</div></div><div className="logTable"><div className="sectionIntro"><div><p className="label">最近记录</p><h2>逐组明细</h2></div></div>{logs.length===0?<p className="empty">完成第一组后，这里会自动出现重量、次数和 RIR。</p>:<div className="tableWrap"><table><thead><tr><th>Day</th><th>模板</th><th>动作</th><th>重量</th><th>次数</th><th>RIR</th><th></th></tr></thead><tbody>{[...logs].reverse().slice(0,20).map(log=><tr key={log.id}><td>{log.day}</td><td>{templates.find(t=>t.id===log.templateId)?.name}</td><td>{log.exercise}</td><td>{log.loadMode === "sides" ? `左 ${log.leftWeight} / 右 ${log.rightWeight} kg` : `${log.weight} kg`}</td><td>{log.reps}</td><td>{log.rir}</td><td><button className="delete" onClick={()=>setLogs(current=>current.filter(item=>item.id!==log.id))}>删除</button></td></tr>)}</tbody></table></div>}</div></section>}
      </section>
      {saved && <div className="toast" role="status">已保存到本机</div>}
    </main>
  );
}

function NumberField({label,unit,value,min,max,step=1,onChange}:{label:string;unit:string;value:number;min:number;max:number;step?:number;onChange:(value:number)=>void}) {
  return <label className="field"><span>{label}<small>{unit}</small></span><input type="number" value={value} min={min} max={max} step={step} onChange={e=>onChange(Number(e.target.value))}/></label>;
}

function SetForm({ exercise, onSubmit }: { exercise: string; onSubmit: (exercise: string, form: HTMLFormElement) => void }) {
  const [loadMode, setLoadMode] = useState<LoadMode>("sides");
  return <form className="setForm" onSubmit={(event)=>{event.preventDefault(); onSubmit(exercise, event.currentTarget)}}>
    <label className="loadMode">重量方式<select name="loadMode" value={loadMode} onChange={(event)=>setLoadMode(event.target.value as LoadMode)}><option value="sides">左右分别记录</option><option value="total">总重量</option></select></label>
    {loadMode === "sides" ? <><label>左 kg<input name="leftWeight" type="number" min="0" step="0.5" placeholder="0" required /></label><label>右 kg<input name="rightWeight" type="number" min="0" step="0.5" placeholder="0" required /></label></> : <label>总重量 kg<input name="weight" type="number" min="0" step="0.5" placeholder="0" required /></label>}
    <label>次数<input name="reps" type="number" min="1" max="100" placeholder="10" required /></label>
    <label>RIR<input name="rir" type="number" min="0" max="5" placeholder="2" required /></label>
    <button type="submit">记录一组</button>
  </form>;
}


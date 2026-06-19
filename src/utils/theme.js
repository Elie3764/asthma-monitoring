export const THEMES = {
  light:{name:"Clair",icon:"??",bg:"#eef1f8",bg2:"#ffffff",surface:"#ffffff",surface2:"#f0f3f9",border:"rgba(100,130,200,0.15)",text:"#1a2540",text2:"#4a6080",text3:"#9aafc4",primary:"#00c9a7",primary2:"#00a88a",green:"#00c9a7",yellow:"#f5a623",orange:"#e06020",red:"#e53e3e",purple:"#6c63ff",card:"#ffffff",tabBar:"#ffffff",tabBorder:"rgba(0,0,0,0.07)",statusBar:"dark-content",inputBg:"#f0f3f9"},
  dark:{name:"Sombre",icon:"??",bg:"#0d1829",bg2:"#111f35",surface:"#162540",surface2:"#1e2f4a",border:"rgba(0,210,255,0.15)",text:"#e8f4ff",text2:"#8ba8c4",text3:"#4d6a85",primary:"#00c9a7",primary2:"#00a88a",green:"#00e5a0",yellow:"#ffd84d",orange:"#ff8c42",red:"#ff3d5a",purple:"#a78bfa",card:"#162540",tabBar:"#111f35",tabBorder:"rgba(0,210,255,0.12)",statusBar:"light-content",inputBg:"#1e2f4a"},
  teal:{name:"Sarcelle",icon:"??",bg:"#041a1a",bg2:"#062020",surface:"#082828",surface2:"#0a3030",border:"rgba(0,255,210,0.15)",text:"#e0fff8",text2:"#60c8b8",text3:"#308878",primary:"#00ffe0",primary2:"#00c8b0",green:"#00ff90",yellow:"#ffee44",orange:"#ff9040",red:"#ff4060",purple:"#a060ff",card:"#082828",tabBar:"#062020",tabBorder:"rgba(0,255,210,0.15)",statusBar:"light-content",inputBg:"#0a3030"},
  violet:{name:"Violet",icon:"??",bg:"#0d0720",bg2:"#130a2e",surface:"#180e38",surface2:"#1e1240",border:"rgba(160,100,255,0.2)",text:"#f0e8ff",text2:"#9080c0",text3:"#604880",primary:"#a060ff",primary2:"#8040e0",green:"#40ffb0",yellow:"#ffd840",orange:"#ff8040",red:"#ff4070",purple:"#c080ff",card:"#180e38",tabBar:"#130a2e",tabBorder:"rgba(160,100,255,0.2)",statusBar:"light-content",inputBg:"#1e1240"},
};
export const DEFAULT_THEME="light";
export const getTheme=(n)=>THEMES[n]||THEMES.light;
export const getVitalColor=(type,val,t)=>{
  if(val==null)return t.text3;
  switch(type){
    case"spo2":return val<88?t.red:val<92?t.orange:val<95?t.yellow:t.green;
    case"hr":return(val>110||val<45)?t.red:val>100?t.orange:t.primary;
    case"temp":return val>=39?t.red:val>=38?t.yellow:t.green;
    case"resp":return val>25?t.red:val>20?t.orange:t.purple;
    default:return t.primary;
  }
};
export const getVitalStatus=(type,val)=>{
  if(val==null)return{label:"--",icon:"?"};
  switch(type){
    case"spo2":if(val<88)return{label:"CRITIQUE",icon:"??"};if(val<92)return{label:"ALERTE",icon:"??"};if(val<95)return{label:"Limite",icon:"??"};return{label:"Normal",icon:"??"};
    case"hr":if(val>110||val<45)return{label:"Anormal",icon:"??"};if(val>100)return{label:"Élevé",icon:"??"};return{label:"Normal",icon:"??"};
    case"temp":if(val>=39)return{label:"Fièvre",icon:"??"};if(val>=38)return{label:"Subfébrile",icon:"??"};return{label:"Normal",icon:"??"};
    case"resp":if(val>25)return{label:"Critique",icon:"??"};if(val>20)return{label:"Tachypnée",icon:"??"};return{label:"Normal",icon:"??"};
    default:return{label:"Normal",icon:"??"};
  }
};

import React from"react";
import{View,StyleSheet}from"react-native";
export default function LungLogo({size=130}){
  const scale=size/130;
  return(
    <View style={{width:size,height:size,alignItems:"center",justifyContent:"center"}}>
      <View style={[s.trachea,{transform:[{scale}]}]}/>
      <View style={[s.lungsRow,{transform:[{scale}]}]}>
        <View style={s.leftLung}>
          <View style={s.crease}/>
        </View>
        <View style={s.heart}/>
        <View style={s.rightLung}>
          <View style={s.creaseRight}/>
        </View>
      </View>
    </View>
  );
}
const s=StyleSheet.create({
  trachea:{position:"absolute",top:6,width:14,height:30,borderRadius:7,backgroundColor:"#9fdccb",zIndex:1},
  lungsRow:{flexDirection:"row",alignItems:"flex-end",marginTop:14},
  leftLung:{width:42,height:78,backgroundColor:"#4fc3b0",borderTopLeftRadius:38,borderTopRightRadius:14,borderBottomLeftRadius:30,borderBottomRightRadius:34,marginRight:-6,overflow:"hidden"},
  rightLung:{width:48,height:84,backgroundColor:"#52aee0",borderTopRightRadius:38,borderTopLeftRadius:14,borderBottomRightRadius:30,borderBottomLeftRadius:34,marginLeft:-6,overflow:"hidden"},
  crease:{position:"absolute",left:10,top:20,width:2,height:46,backgroundColor:"#ffffff",opacity:0.3,borderRadius:1,transform:[{rotate:"8deg"}]},
  creaseRight:{position:"absolute",right:10,top:20,width:2,height:46,backgroundColor:"#ffffff",opacity:0.3,borderRadius:1,transform:[{rotate:"-8deg"}]},
  heart:{width:18,height:18,backgroundColor:"#f2667e",borderRadius:5,transform:[{rotate:"45deg"}],marginBottom:18,marginHorizontal:-3,zIndex:2},
});

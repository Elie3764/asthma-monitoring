import{Vibration}from"react-native";
export const playNotificationSound=()=>{
  Vibration.vibrate(150);
};
export const playAlertSound=()=>{
  Vibration.vibrate([0,400,200,400,200,400,200,400,200,400]);
};

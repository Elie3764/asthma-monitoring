/*
 * ================================================================
 * ASTHMA MONITORING WATCH v4.2
 * SUPPTIC · ENSP Yaounde · 2026
 * ================================================================
 * PAGES :
 *   0 HOME    — Heure + SpO2 + FC
 *   1 VITAUX  — Tous les capteurs
 *   2 GPS     — Localisation
 *   3 CONSEIL — Alertes et conseils
 *   4 SYSINFO — Infos systeme
 *   5 REGLAGES— Affichage/Son/Economie/A propos
 * ================================================================
 * NAVIGATION :
 *   BTN1 = page suivante (SEULEMENT si on appuie)
 *   BTN2 = retour accueil / acquitter alerte
 *   Les pages NE CHANGENT JAMAIS seules sauf alerte
 * ================================================================
 */

#include <Wire.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include "MAX30105.h"
#include <MPU6050.h>
#include "RTClib.h"
#include "DHT.h"
#include <TinyGPSPlus.h>
#include <HardwareSerial.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include "driver/dac.h"
#include <math.h>
#include "all_wallpapers.h"

// ===== PINS =====
#define PIN_TFT_CS   5
#define PIN_TFT_DC   2
#define PIN_TFT_RST  15
#define PIN_TFT_MOSI 23
#define PIN_TFT_SCLK 18
#define PIN_DHT      4
#define PIN_SIM_RX   16
#define PIN_SIM_TX   17
#define PIN_GPS_RX   13
#define PIN_GPS_TX   14
#define PIN_DAC      25
#define PIN_VIBR     26
#define PIN_BTN1     32
#define PIN_BTN2     34
#define PIN_LED      33
#define DHT_TYPE     DHT22

// ===== BLE =====
#define BLE_SERVICE_UUID      "4fafc201-1fb5-459e-8fcc-c5c9c3319142"
#define BLE_CHAR_PAIRING_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define BLE_CHAR_UID_UUID     "beb5483e-36e1-4688-b7f5-ea07361b26a9"
#define BLE_CHAR_VITALS_UUID  "beb5483e-36e1-4688-b7f5-ea07361b26aa"

// ===== SEUILS =====
#define SPO2_CRITIQUE  88
#define SPO2_WARNING   92
#define FC_CRITIQUE   120
#define FC_WARNING    100
#define FC_LOW         50
#define TEMP_CRITIQUE  39.5
#define TEMP_FIEVRE    38.0
#define TEMP_HYPOTHERM 35.0
#define HUM_HIGH       80
#define RESP_HIGH      25
#define RESP_WARNING   20
#define RESP_LOW       12

// ===== TIMEOUT APPAIRAGE =====
// 10 minutes en millisecondes
#define PAIRING_TIMEOUT_MS 600000UL

#define FW_VERSION   "v4.2"
#define FW_DATE      "18/07/2026"
#define TOTAL_THEMES 10

// ===== PAGES =====
enum Page {
  PAGE_HOME=0, PAGE_VITALS, PAGE_GPS,
  PAGE_CONSEIL, PAGE_SYSINFO, PAGE_REGLAGES
};
#define TOTAL_PAGES 6

enum AlertLevel { NORMAL=0, WARNING, CRITIQUE };

// ===== SOUS-MENU REGLAGES =====
enum ReglagesMenu {
  REG_AFFICHAGE=0, REG_SON, REG_ECONOMIE, REG_APROPOS, REG_TOTAL
};

// ===== THEMES =====
const uint16_t* themes[] = {
  THEME_AURORA, THEME_OCEAN, THEME_SUNSET, THEME_MINIMAL,
  THEME_SAKURA, THEME_COSMOS, THEME_SOMBRE, THEME_MEDICAL,
  THEME_NUIT,   THEME_NATURE
};
const char* themeNames[] = {
  "Aurora","Ocean","Sunset","Minimal",
  "Sakura","Cosmos","Sombre","Medical","Nuit","Nature"
};

// ===== OBJETS =====
Adafruit_ST7735 tft = Adafruit_ST7735(PIN_TFT_CS,PIN_TFT_DC,
                                       PIN_TFT_MOSI,PIN_TFT_SCLK,PIN_TFT_RST);
MAX30105    ox;
MPU6050     imu;
RTC_DS3231  rtc;
DHT         dht(PIN_DHT, DHT_TYPE);
TinyGPSPlus gps;
HardwareSerial SIM(2);
HardwareSerial GPS_S(1);
Preferences prefs;

// ===== BLE =====
BLEServer*         pServer      = nullptr;
BLECharacteristic* pCharPairing = nullptr;
BLECharacteristic* pCharUID     = nullptr;
BLECharacteristic* pCharVitals  = nullptr;
bool bleConnected = false;

// ===== VARIABLES GLOBALES =====
Page       currentPage  = PAGE_HOME;
int        currentTheme = 0;
AlertLevel currentLevel = NORMAL;
AlertLevel lastLevel    = NORMAL;
bool       alertActive  = false;
bool       pairingDone  = false;
String     patientUID   = "";
String     phoneNumber  = "";
String     pairingCode  = "";
String     alertMsg     = "";
String     adviceMsg    = "";
String     actionMsg    = "";
int        simSignal    = 0;
float      battPercent  = 100.0;

// ===== REGLAGES UTILISATEUR =====
bool  sonActive     = true;
bool  vibrActive    = true;
bool  econActive    = false;   // economie d'energie
int   brillo        = 3;       // luminosite 1-5 (simulee)
int   regMenu       = REG_AFFICHAGE; // sous-menu actif

// ===== VITAUX =====
struct Vitals {
  int   spo2=0, hr=0, resp=16, sats=0;
  float temp=0, hum=0, lat=0, lng=0;
  bool  gpsOk=false;
} v;

uint32_t irBuf[100], redBuf[100];

// ===== TIMERS =====
unsigned long lastRead    = 0;
unsigned long lastBtn1    = 0;
unsigned long lastBtn2    = 0;
unsigned long lastBLE     = 0;
unsigned long lastSignal  = 0;
unsigned long startTime   = 0;
unsigned long pairingStart= 0; // debut du mode appairage

// ===== ETAT ECRAN APPAIRAGE =====
// On ne redessine que si necessaire
bool pairingScreenDrawn = false;
bool lastBleConnected   = false;

// ====================================================================
// DECLARATIONS ANTICIPEES
// ====================================================================
void playNotif();  void playTone(int,int,int); void vibrate(int);
void playWarning(); void playCritique(); void playRetourNormal();
void showPairingScreen(); void showPairingOK();
void drawPage(Page p); void drawPageHome(); void drawPageVitals();
void drawPageGPS(); void drawPageConseil(); void drawPageSysInfo();
void drawPageReglages();
void readPhoneFromSIM(); void checkSimSignal(); void sendSMS(String);
void printWrapped(String,int,int,int);
void drawVitalRow(int,const char*,String,AlertLevel,int,int,int);
void drawSysRow(int,const char*,String,uint16_t);
void readAllSensors(); void analyzeVitals(); void triggerAlert();
void initBLE(); String genCode(); String buildJSON();
void drawWallpaper(int); void showSplash(); void handleButtons(unsigned long);
void saveSettings(); void loadSettings();
// Mise a jour partielle ecran appairage
void updatePairingStatus();

// ====================================================================
// BLE CALLBACKS
// ====================================================================
class WatchBLECallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* s) {
    bleConnected = true;
    digitalWrite(PIN_LED, HIGH);
  }
  void onDisconnect(BLEServer* s) {
    bleConnected = false;
    digitalWrite(PIN_LED, LOW);
    BLEDevice::startAdvertising();
  }
};

class UIDCallback : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pC) {
    String rx = pC->getValue().c_str();
    if (rx.startsWith("UID:")) {
      int sep = rx.indexOf("|PHONE:");
      patientUID  = (sep>0) ? rx.substring(4,sep) : rx.substring(4);
      if (phoneNumber.length()==0 && sep>0)
        phoneNumber = rx.substring(sep+7);
      prefs.begin("watch",false);
      prefs.putString("uid",patientUID);
      prefs.putString("phone",phoneNumber);
      prefs.putString("code",pairingCode);
      prefs.end();
      pairingDone = true;
      pCharPairing->setValue(("OK:"+pairingCode).c_str());
      pCharPairing->notify();
      if (sonActive) playNotif();
      if (vibrActive) { vibrate(200); delay(100); vibrate(200); }
      showPairingOK();
    }
    if (rx.startsWith("THEME:")) {
      int t = rx.substring(6).toInt();
      if (t>=0 && t<TOTAL_THEMES) {
        currentTheme = t;
        prefs.begin("watch",false);
        prefs.putInt("theme",t);
        prefs.end();
        if (currentPage==PAGE_HOME) drawPageHome();
      }
    }
  }
};

// ====================================================================
// PARAMETRES
// ====================================================================
void saveSettings() {
  prefs.begin("cfg",false);
  prefs.putBool("son",    sonActive);
  prefs.putBool("vibr",   vibrActive);
  prefs.putBool("econ",   econActive);
  prefs.putInt("brill",   brillo);
  prefs.putInt("theme",   currentTheme);
  prefs.end();
}

void loadSettings() {
  prefs.begin("cfg",true);
  sonActive    = prefs.getBool("son",   true);
  vibrActive   = prefs.getBool("vibr",  true);
  econActive   = prefs.getBool("econ",  false);
  brillo       = prefs.getInt("brill",  3);
  currentTheme = prefs.getInt("theme",  0);
  prefs.end();
}

// ====================================================================
// LECTURE NUMERO SIM
// ====================================================================
void readPhoneFromSIM() {
  tft.setTextSize(1);
  tft.setTextColor(tft.color565(0,200,160));
  tft.setCursor(4,138); tft.print("Lecture SIM...");
  SIM.println("AT+CNUM");
  delay(3000);
  String r=""; unsigned long t=millis();
  while(millis()-t<3000) if(SIM.available()) r+=(char)SIM.read();
  int idx=r.indexOf("+CNUM:");
  if(idx>=0){
    int q1=r.indexOf("\"",idx),q2=r.indexOf("\"",q1+1);
    int q3=r.indexOf("\"",q2+1)+1,q4=r.indexOf("\"",q3);
    if(q3>0&&q4>q3){
      String n=r.substring(q3,q4);
      if(n.length()>=8){
        phoneNumber=n;
        prefs.begin("watch",false); prefs.putString("phone",n); prefs.end();
        tft.fillRect(0,134,80,14,ST77XX_BLACK);
        tft.setTextColor(ST77XX_GREEN);
        tft.setCursor(4,138); tft.print("SIM:"+n);
        delay(1500); return;
      }
    }
  }
  if(phoneNumber.length()==0){
    prefs.begin("watch",true); phoneNumber=prefs.getString("phone",""); prefs.end();
  }
  tft.fillRect(0,134,80,14,ST77XX_BLACK);
  tft.setTextColor(phoneNumber.length()>0?tft.color565(255,165,0):tft.color565(150,0,0));
  tft.setCursor(4,138);
  tft.print(phoneNumber.length()>0?"Mem:"+phoneNumber:"Num non trouve");
  delay(800);
}

// ====================================================================
// SETUP
// ====================================================================
void setup() {
  Serial.begin(115200);
  Wire.begin(21,22);
  SIM.begin(9600,SERIAL_8N1,PIN_SIM_RX,PIN_SIM_TX);
  GPS_S.begin(9600,SERIAL_8N1,PIN_GPS_RX,PIN_GPS_TX);
  pinMode(PIN_VIBR,OUTPUT); pinMode(PIN_BTN1,INPUT_PULLUP);
  pinMode(PIN_BTN2,INPUT_PULLUP); pinMode(PIN_LED,OUTPUT);
  digitalWrite(PIN_VIBR,LOW); digitalWrite(PIN_LED,LOW);
  dac_output_enable(DAC_CHANNEL_1);
  dac_output_voltage(DAC_CHANNEL_1,128);
  startTime = millis();

  tft.initR(INITR_MINI160x80);
  tft.setRotation(1);
  showSplash();

  // Charger les parametres
  loadSettings();

  // Charger donnees compte
  prefs.begin("watch",true);
  patientUID  = prefs.getString("uid",   "");
  phoneNumber = prefs.getString("phone", "");
  pairingCode = prefs.getString("code",  "");
  prefs.end();

  pairingDone = (patientUID.length()>0);
  if (!pairingDone) {
    pairingCode  = genCode();
    pairingStart = millis();
  }

  // Init capteurs
  if(ox.begin(Wire,I2C_SPEED_FAST)){
    ox.setup(); ox.setPulseAmplitudeRed(0x0A); ox.setPulseAmplitudeGreen(0);
  }
  imu.initialize();
  if(rtc.begin()&&rtc.lostPower()) rtc.adjust(DateTime(F(__DATE__),F(__TIME__)));
  dht.begin();

  // SIM800L
  delay(5000);
  SIM.println("AT+CMGF=1"); delay(500);
  readPhoneFromSIM();
  checkSimSignal();

  // BLE
  initBLE();

  // Sons demarrage
  if(sonActive) playNotif();
  if(vibrActive){ vibrate(150); delay(100); vibrate(150); }

  Serial.println("=== PRET ===");

  if(pairingDone) drawPage(PAGE_HOME);
  else {
    pairingScreenDrawn = false;
    showPairingScreen();
    pairingScreenDrawn = true;
  }
}

// ====================================================================
// LOOP
// ====================================================================
void loop() {
  unsigned long now = millis();

  // GPS
  while(GPS_S.available()){
    if(gps.encode(GPS_S.read())){
      if(gps.location.isValid()){
        v.lat=gps.location.lat(); v.lng=gps.location.lng(); v.gpsOk=true;
      }
      v.sats=gps.satellites.value();
    }
  }
  while(SIM.available()) Serial.write(SIM.read());

  // ================================================================
  // MODE APPAIRAGE
  // L'ecran NE CHANGE JAMAIS sans action bouton
  // ================================================================
  if (!pairingDone) {
    // LED clignote
    digitalWrite(PIN_LED,(now/600)%2);

    // Dessiner l'ecran une seule fois au demarrage
    if (!pairingScreenDrawn) {
      showPairingScreen();
      pairingScreenDrawn = true;
      lastBleConnected = bleConnected;
    }

    // Mettre a jour SEULEMENT la ligne statut BLE si ca change
    if (bleConnected != lastBleConnected) {
      lastBleConnected = bleConnected;
      updatePairingStatus();
    }

    // Timeout : regenerer code apres PAIRING_TIMEOUT_MS (10 min)
    if (now - pairingStart > PAIRING_TIMEOUT_MS) {
      pairingCode  = genCode();
      pairingStart = now;
      prefs.begin("watch",false);
      prefs.putString("code",pairingCode);
      prefs.end();
      pairingScreenDrawn = false; // forcer redessinage avec nouveau code
    }

    // BTN1 = nouveau code manuellement
    if (digitalRead(PIN_BTN1)==LOW && now-lastBtn1>400) {
      lastBtn1 = now;
      pairingCode  = genCode();
      pairingStart = now;
      prefs.begin("watch",false);
      prefs.putString("code",pairingCode);
      prefs.end();
      pairingScreenDrawn = false;
      while(digitalRead(PIN_BTN1)==LOW);
    }
    return; // SORTIR — rien d'autre ne s'execute
  }

  // ================================================================
  // MODE NORMAL
  // Les pages NE CHANGENT JAMAIS seules sauf alert
  // ================================================================

  // Lecture capteurs toutes les 2 secondes
  // NE PAS redessiner la page — seulement si alerte change
  if (now-lastRead > 2000) {
    readAllSensors();
    analyzeVitals();
    lastRead = now;

    // Changer de page SEULEMENT si niveau d'alerte change
    if (currentLevel != lastLevel) {
      triggerAlert();
      lastLevel = currentLevel;
    }
    // NE PAS appeler drawPage ici — la page reste stable
  }

  // Signal SIM
  if (now-lastSignal > 20000) {
    checkSimSignal();
    lastSignal = now;
  }

  // BLE vitaux
  if (bleConnected && now-lastBLE > 3000) {
    pCharVitals->setValue(buildJSON().c_str());
    pCharVitals->notify();
    lastBLE = now;
  }

  // LED alerte
  if (alertActive) digitalWrite(PIN_LED,(now/300)%2);
  else if (!pairingDone) digitalWrite(PIN_LED,LOW);

  handleButtons(now);
}

// ====================================================================
// MISE A JOUR PARTIELLE ECRAN APPAIRAGE (statut BLE seulement)
// ====================================================================
void updatePairingStatus() {
  // Effacer juste la zone statut
  tft.fillRect(0,112,80,20,tft.color565(4,4,18));
  tft.setTextSize(1);
  tft.setCursor(4,116);
  tft.setTextColor(tft.color565(80,80,80));
  tft.print("BLE: ");
  tft.setTextColor(bleConnected ? ST77XX_GREEN : tft.color565(255,165,0));
  tft.print(bleConnected ? "Connecte!" : "En attente...");
}

// ====================================================================
// UTILITAIRES
// ====================================================================
String genCode() {
  randomSeed(esp_random());
  return String(random(100000,999999));
}

void initBLE() {
  String name = "AsthmaWatch-"+pairingCode.substring(0,3);
  BLEDevice::init(name.c_str());
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new WatchBLECallbacks());
  BLEService* svc = pServer->createService(BLE_SERVICE_UUID);
  pCharPairing = svc->createCharacteristic(BLE_CHAR_PAIRING_UUID,
    BLECharacteristic::PROPERTY_READ|BLECharacteristic::PROPERTY_NOTIFY);
  pCharPairing->addDescriptor(new BLE2902());
  pCharPairing->setValue(("CODE:"+pairingCode).c_str());
  pCharUID = svc->createCharacteristic(BLE_CHAR_UID_UUID,
    BLECharacteristic::PROPERTY_WRITE);
  pCharUID->setCallbacks(new UIDCallback());
  pCharVitals = svc->createCharacteristic(BLE_CHAR_VITALS_UUID,
    BLECharacteristic::PROPERTY_NOTIFY);
  pCharVitals->addDescriptor(new BLE2902());
  svc->start();
  BLEDevice::getAdvertising()->addServiceUUID(BLE_SERVICE_UUID);
  BLEDevice::getAdvertising()->setScanResponse(true);
  BLEDevice::startAdvertising();
}

void checkSimSignal() {
  SIM.println("AT+CSQ"); delay(500);
  String r=""; unsigned long t=millis();
  while(millis()-t<1000) if(SIM.available()) r+=(char)SIM.read();
  int idx=r.indexOf("+CSQ: ");
  if(idx>=0) simSignal=r.substring(idx+6,r.indexOf(",",idx)).toInt();
}

void sendSMS(String msg) {
  if(phoneNumber.length()==0) return;
  SIM.println("AT+CMGF=1"); delay(500);
  SIM.println("AT+CMGS=\""+phoneNumber+"\""); delay(1000);
  SIM.print(msg); SIM.write(26); delay(2000);
}

String buildJSON() {
  return "{\"spo2\":"+String(v.spo2)+
         ",\"hr\":"+String(v.hr)+
         ",\"temp\":"+String(v.temp,1)+
         ",\"hum\":"+String((int)v.hum)+
         ",\"resp\":"+String(v.resp)+
         ",\"lat\":"+String(v.lat,6)+
         ",\"lng\":"+String(v.lng,6)+
         ",\"gps\":"+(v.gpsOk?"true":"false")+
         ",\"batt\":"+String((int)battPercent)+
         ",\"alert\":"+String(currentLevel)+"}";
}

// ====================================================================
// CAPTEURS
// ====================================================================
void readAllSensors() {
  const int N=100;
  long irS=0,redS=0,irMax=0,irMin=999999,redMax=0,redMin=999999;
  int beats=0; bool wasAbove=false;
  for(byte i=0;i<N;i++){
    while(!ox.available()) ox.check();
    long ir=ox.getIR(),red=ox.getRed();
    irBuf[i]=ir; redBuf[i]=red; ox.nextSample();
    irS+=ir; redS+=red;
    if(ir>irMax) irMax=ir; if(ir<irMin) irMin=ir;
    if(red>redMax) redMax=red; if(red<redMin) redMin=red;
    long m=irS/(i+1);
    if(ir>m*1.02&&!wasAbove){beats++;wasAbove=true;}
    else if(ir<m) wasAbove=false;
  }
  long irM=irS/N,redM=redS/N;
  if(irM>50000){
    float irAC=(irMax-irMin)/2.0f,redAC=(redMax-redMin)/2.0f;
    float R=(redAC/redM)/(irAC/irM);
    v.spo2=constrain((int)(110.0f-25.0f*R),80,100);
    v.hr=constrain(beats*60,40,200);
  } else { v.spo2=0; v.hr=0; }
  float t=dht.readTemperature(),h=dht.readHumidity();
  if(!isnan(t)) v.temp=t; if(!isnan(h)) v.hum=h;
  int16_t ax,ay,az,gx,gy,gz;
  imu.getMotion6(&ax,&ay,&az,&gx,&gy,&gz);
  static float lastAz=az;
  if(abs(az-lastAz)>500) v.resp=constrain(v.resp+1,8,40);
  else v.resp=constrain(v.resp-1,10,35);
  lastAz=az;
  battPercent=max(0.0f,battPercent-0.002f);
}

void analyzeVitals() {
  currentLevel=NORMAL; alertMsg=adviceMsg=actionMsg="";
  if(v.spo2>0&&v.spo2<SPO2_CRITIQUE){
    currentLevel=CRITIQUE;
    alertMsg="SpO2 CRITIQUE:"+String(v.spo2)+"%";
    adviceMsg="Oxygene bas! Arretez.";
    actionMsg="Appelez le 15!";
  } else if(v.hr>FC_CRITIQUE){
    currentLevel=CRITIQUE;
    alertMsg="Tachycardie:"+String(v.hr)+"bpm";
    adviceMsg="FC tres elevee!";
    actionMsg="Asseyez-vous, medecin.";
  } else if(v.temp>=TEMP_CRITIQUE){
    currentLevel=CRITIQUE;
    alertMsg="Fievre:"+String(v.temp,1)+"C";
    adviceMsg="Fievre dangereuse!";
    actionMsg="Paracetamol+urgences.";
  } else if(v.resp>RESP_HIGH){
    currentLevel=CRITIQUE;
    alertMsg="Detresse:"+String(v.resp)+"/min";
    adviceMsg="Crise asthme!";
    actionMsg="Bronchodilatateur+15.";
  } else if(v.spo2>0&&v.spo2<SPO2_WARNING){
    currentLevel=WARNING;
    alertMsg="SpO2 basse:"+String(v.spo2)+"%";
    adviceMsg="Respirez profond.";
    actionMsg="Repos, surveillez.";
  } else if(v.hr>FC_WARNING){
    currentLevel=WARNING;
    alertMsg="FC elevee:"+String(v.hr)+"bpm";
    adviceMsg="Reposez-vous.";
    actionMsg="Respirez 5min.";
  } else if(v.temp>=TEMP_FIEVRE){
    currentLevel=WARNING;
    alertMsg="Fievre:"+String(v.temp,1)+"C";
    adviceMsg="Hydratez-vous.";
    actionMsg="Paracetamol, repos.";
  } else if(v.resp>RESP_WARNING){
    currentLevel=WARNING;
    alertMsg="Resp rapide:"+String(v.resp)+"/min";
    adviceMsg="Ralentissez.";
    actionMsg="4s inspire,4s expire.";
  } else if(v.hum>HUM_HIGH){
    currentLevel=WARNING;
    alertMsg="Humidite:"+String((int)v.hum)+"%";
    adviceMsg="Risque asthme.";
    actionMsg="Aerez la piece.";
  }
}

void triggerAlert() {
  if(currentLevel==NORMAL&&lastLevel!=NORMAL){
    alertActive=false; digitalWrite(PIN_LED,LOW);
    if(sonActive) playRetourNormal();
    if(vibrActive) vibrate(100);
    currentPage=PAGE_HOME; drawPage(PAGE_HOME); return;
  }
  alertActive=true;
  if(currentLevel==WARNING){
    if(sonActive) playWarning();
    if(vibrActive){vibrate(300);delay(100);vibrate(300);}
    currentPage=PAGE_CONSEIL; drawPage(PAGE_CONSEIL);
  }
  if(currentLevel==CRITIQUE){
    if(sonActive) playCritique();
    if(vibrActive) for(int i=0;i<5;i++){vibrate(400);delay(150);}
    sendSMS("[ALERTE ASTHME] "+alertMsg+
            " SpO2:"+String(v.spo2)+"%"+
            " FC:"+String(v.hr)+"bpm"+
            " T:"+String(v.temp,1)+"C"+
            (v.gpsOk?" GPS:"+String(v.lat,4)+","+String(v.lng,4):""));
    currentPage=PAGE_CONSEIL; drawPage(PAGE_CONSEIL);
  }
}

// ====================================================================
// WALLPAPER
// ====================================================================
void drawWallpaper(int idx) {
  const uint16_t* img=themes[idx%TOTAL_THEMES];
  tft.startWrite(); tft.setAddrWindow(0,0,80,160);
  for(int i=0;i<80*160;i++){
    uint16_t px=pgm_read_word(&img[i]);
    tft.writePixel(i%80,i/80,(px>>8)|(px<<8));
  }
  tft.endWrite();
}

void drawPage(Page p) {
  switch(p){
    case PAGE_HOME:     drawPageHome();     break;
    case PAGE_VITALS:   drawPageVitals();   break;
    case PAGE_GPS:      drawPageGPS();      break;
    case PAGE_CONSEIL:  drawPageConseil();  break;
    case PAGE_SYSINFO:  drawPageSysInfo();  break;
    case PAGE_REGLAGES: drawPageReglages(); break;
  }
}

// ====================================================================
// PAGE 1 — HOME
// ====================================================================
void drawPageHome() {
  drawWallpaper(currentTheme);
  DateTime now=rtc.now();
  // Bande noire haut pour heure lisible
  tft.fillRect(0,0,80,40,tft.color565(0,0,0));
  tft.setTextSize(2); tft.setTextColor(ST77XX_WHITE);
  char tb[6]; sprintf(tb,"%02d:%02d",now.hour(),now.minute());
  tft.setCursor(4,4); tft.print(tb);
  tft.setTextSize(1); tft.setTextColor(tft.color565(150,150,150));
  char sb[4]; sprintf(sb,":%02d",now.second());
  tft.setCursor(58,10); tft.print(sb);
  tft.setTextColor(tft.color565(200,200,200)); tft.setCursor(4,26);
  const char* j[]={"Dim","Lun","Mar","Mer","Jeu","Ven","Sam"};
  char db[14]; sprintf(db,"%s %02d/%02d/%04d",j[now.dayOfTheWeek()],now.day(),now.month(),now.year());
  tft.print(db);
  tft.drawFastHLine(0,39,80,tft.color565(60,60,60));
  // SpO2
  uint16_t cS=(v.spo2>0&&v.spo2<SPO2_CRITIQUE)?ST77XX_RED:
               (v.spo2>0&&v.spo2<SPO2_WARNING)?tft.color565(255,165,0):
               tft.color565(0,220,150);
  tft.setTextColor(tft.color565(150,150,150)); tft.setCursor(4,46); tft.setTextSize(1); tft.print("SpO2");
  tft.setTextSize(3); tft.setTextColor(cS); tft.setCursor(4,55);
  if(v.spo2>0){tft.print(v.spo2);tft.setTextSize(1);tft.print("%");}
  else{tft.setTextSize(2);tft.print("--");}
  tft.drawFastVLine(52,44,32,tft.color565(50,50,50));
  // FC
  uint16_t cH=(v.hr>FC_CRITIQUE)?ST77XX_RED:(v.hr>FC_WARNING)?tft.color565(255,165,0):tft.color565(255,100,120);
  tft.setTextColor(tft.color565(150,150,150)); tft.setCursor(56,46); tft.setTextSize(1); tft.print("FC");
  tft.setTextSize(2); tft.setTextColor(cH); tft.setCursor(56,55);
  if(v.hr>0)tft.print(v.hr);else tft.print("--");
  tft.setTextSize(1); tft.setTextColor(tft.color565(120,120,120)); tft.setCursor(56,72); tft.print("bpm");
  tft.drawFastHLine(0,82,80,tft.color565(50,50,50));
  // Temp + Hum
  tft.setTextSize(1);
  tft.setTextColor(v.temp>=TEMP_FIEVRE?tft.color565(255,100,0):tft.color565(100,200,255));
  tft.setCursor(4,88); tft.print("T:"); tft.print(v.temp,1); tft.print("C");
  tft.setTextColor(tft.color565(100,180,255)); tft.setCursor(42,88);
  tft.print("H:"); tft.print((int)v.hum); tft.print("%");
  // Resp
  uint16_t cR=(v.resp>RESP_HIGH||v.resp<RESP_LOW)?tft.color565(255,165,0):tft.color565(0,200,100);
  tft.setTextColor(cR); tft.setCursor(4,100);
  tft.print("Resp:"); tft.print(v.resp); tft.print("/min");
  tft.drawFastHLine(0,112,80,tft.color565(40,40,40));
  // Statut
  uint16_t sc; const char* st;
  if(currentLevel==CRITIQUE){sc=ST77XX_RED;st="!!! ALERTE !!!";}
  else if(currentLevel==WARNING){sc=tft.color565(255,165,0);st="! Attention !";}
  else{sc=tft.color565(0,200,100);st="Parametres OK";}
  tft.setTextColor(sc); tft.setCursor(4,118); tft.print(st);
  // Indicateurs
  tft.setCursor(4,130);
  tft.setTextColor(bleConnected?tft.color565(0,180,100):tft.color565(60,60,60)); tft.print("BLE ");
  tft.setTextColor(v.gpsOk?tft.color565(0,180,100):tft.color565(60,60,60)); tft.print("GPS ");
  tft.setTextColor(simSignal>10?tft.color565(0,180,100):simSignal>0?tft.color565(255,165,0):tft.color565(60,60,60));
  tft.print("SIM");
  tft.drawFastHLine(0,142,80,tft.color565(40,40,40));
  tft.setTextColor(tft.color565(60,60,60)); tft.setCursor(4,148);
  tft.print(themeNames[currentTheme]); tft.print(" BTN1>");
}

// ====================================================================
// PAGE 2 — VITAUX
// ====================================================================
void drawPageVitals() {
  tft.fillScreen(ST77XX_BLACK);
  tft.fillRect(0,0,80,14,tft.color565(0,60,100));
  tft.setTextColor(ST77XX_WHITE); tft.setTextSize(1);
  tft.setCursor(4,4); tft.print("VITAUX DETAILLES");
  int y=18;
  drawVitalRow(y,"SpO2",String(v.spo2)+"%",
    (v.spo2>0&&v.spo2<SPO2_CRITIQUE)?CRITIQUE:(v.spo2>0&&v.spo2<SPO2_WARNING)?WARNING:NORMAL,
    85,100,v.spo2); y+=22;
  drawVitalRow(y,"FC",String(v.hr)+"bpm",
    v.hr>FC_CRITIQUE?CRITIQUE:v.hr>FC_WARNING?WARNING:NORMAL,
    40,180,v.hr); y+=22;
  drawVitalRow(y,"Temp",String(v.temp,1)+"C",
    v.temp>=TEMP_CRITIQUE?CRITIQUE:v.temp>=TEMP_FIEVRE?WARNING:NORMAL,
    35,42,(int)(v.temp*10)-350); y+=22;
  drawVitalRow(y,"Hum",String((int)v.hum)+"%",
    v.hum>HUM_HIGH?WARNING:NORMAL,
    0,100,(int)v.hum); y+=22;
  drawVitalRow(y,"Resp",String(v.resp)+"/min",
    v.resp>RESP_HIGH?CRITIQUE:v.resp>RESP_WARNING||v.resp<RESP_LOW?WARNING:NORMAL,
    8,30,v.resp-8);
  tft.setTextColor(tft.color565(50,50,50));
  tft.setCursor(4,150); tft.print("BTN1:> BTN2:home");
}

void drawVitalRow(int y,const char* lbl,String val,AlertLevel lvl,int mn,int mx,int bv){
  if((y/22)%2==0) tft.fillRect(0,y-1,80,22,tft.color565(8,10,14));
  uint16_t c=(lvl==CRITIQUE)?ST77XX_RED:(lvl==WARNING)?tft.color565(255,165,0):tft.color565(0,200,100);
  tft.setTextColor(tft.color565(130,130,130)); tft.setTextSize(1);
  tft.setCursor(4,y+1); tft.print(lbl);
  tft.setTextColor(c); tft.setCursor(34,y+1); tft.print(val);
  int bw=28,bf=map(constrain(bv,0,mx-mn),0,mx-mn,0,bw);
  tft.drawRect(48,y+8,bw,5,tft.color565(40,40,40));
  tft.fillRect(49,y+9,bf,3,c);
  tft.setTextColor(lvl==NORMAL?tft.color565(0,160,80):lvl==WARNING?tft.color565(255,165,0):ST77XX_RED);
  tft.setCursor(4,y+12);
  tft.print(lvl==NORMAL?"OK":lvl==WARNING?"!!":"XX");
}

// ====================================================================
// PAGE 3 — GPS
// ====================================================================
void drawPageGPS() {
  tft.fillScreen(ST77XX_BLACK);
  tft.fillRect(0,0,80,14,tft.color565(0,70,50));
  tft.setTextColor(ST77XX_WHITE); tft.setTextSize(1);
  tft.setCursor(4,4); tft.print("LOCALISATION GPS");
  if(v.gpsOk){
    tft.setTextColor(ST77XX_GREEN);
    tft.setCursor(4,18); tft.print("Fix GPS OK!");
    tft.setCursor(50,18); tft.print(v.sats); tft.print("sat");
    tft.setTextColor(tft.color565(150,150,150));
    tft.setCursor(4,32); tft.print("Latitude:");
    tft.setTextColor(ST77XX_WHITE); tft.setCursor(4,44); tft.print(v.lat,6);
    tft.setTextColor(tft.color565(150,150,150));
    tft.setCursor(4,58); tft.print("Longitude:");
    tft.setTextColor(ST77XX_WHITE); tft.setCursor(4,70); tft.print(v.lng,6);
    int cx=40,cy=108,r=26;
    tft.drawCircle(cx,cy,r,tft.color565(0,80,60));
    tft.drawCircle(cx,cy,r/2,tft.color565(0,60,40));
    tft.drawFastHLine(cx-r,cy,r*2,tft.color565(20,40,30));
    tft.drawFastVLine(cx,cy-r,r*2,tft.color565(20,40,30));
    tft.fillCircle(cx,cy,3,ST77XX_GREEN);
  } else {
    tft.setTextColor(tft.color565(255,165,0));
    tft.setCursor(4,20); tft.print("Recherche signal...");
    tft.setCursor(4,34); tft.print("Satellites: "); tft.print(v.sats);
    int cx=40,cy=88,r=28;
    tft.drawCircle(cx,cy,r,tft.color565(0,80,60));
    tft.drawCircle(cx,cy,r/2,tft.color565(0,60,40));
    tft.drawCircle(cx,cy,r/4,tft.color565(0,50,30));
    float angle=(millis()/400%12)*30*PI/180.0;
    int x2=cx+r*cos(angle),y2=cy+r*sin(angle);
    tft.drawLine(cx,cy,x2,y2,tft.color565(0,180,130));
    tft.setTextColor(tft.color565(70,70,70));
    tft.setCursor(4,130); tft.print("Allez vers une");
    tft.setCursor(4,142); tft.print("fenetre ouverte.");
  }
  tft.setTextColor(tft.color565(50,50,50));
  tft.setCursor(4,154); tft.print("BTN1:> BTN2:home");
}

// ====================================================================
// PAGE 4 — CONSEIL / ALERTE
// ====================================================================
void drawPageConseil() {
  uint16_t bg=(currentLevel==CRITIQUE)?tft.color565(50,0,0):
               (currentLevel==WARNING)?tft.color565(45,25,0):tft.color565(0,25,10);
  tft.fillScreen(bg);
  uint16_t hc=(currentLevel==CRITIQUE)?ST77XX_RED:
               (currentLevel==WARNING)?tft.color565(255,165,0):tft.color565(0,200,100);
  tft.fillRect(0,0,80,14,hc);
  tft.setTextColor(ST77XX_BLACK); tft.setTextSize(1); tft.setCursor(4,4);
  tft.print(currentLevel==CRITIQUE?"!!! ALERTE !!!":
            currentLevel==WARNING ?"! ATTENTION !":"ETAT NORMAL");
  if(currentLevel==NORMAL){
    tft.setTextColor(tft.color565(0,200,100));
    tft.setCursor(4,22); tft.print("Parametres normaux.");
    tft.setTextColor(ST77XX_WHITE);
    tft.setCursor(4,40); tft.print("SpO2:"); tft.print(v.spo2); tft.print("%");
    tft.setCursor(4,52); tft.print("FC:  "); tft.print(v.hr); tft.print("bpm");
    tft.setCursor(4,64); tft.print("Temp:"); tft.print(v.temp,1); tft.print("C");
    tft.setCursor(4,76); tft.print("Resp:"); tft.print(v.resp); tft.print("/min");
  } else {
    tft.setTextColor(ST77XX_WHITE); tft.setCursor(4,18);
    printWrapped(alertMsg,4,18,76);
    tft.drawFastHLine(0,50,80,tft.color565(80,80,80));
    tft.setTextColor(tft.color565(255,220,150)); tft.setCursor(4,56); tft.print("Conseil:");
    tft.setTextColor(ST77XX_WHITE); printWrapped(adviceMsg,4,66,76);
    tft.drawFastHLine(0,104,80,tft.color565(80,80,80));
    tft.setTextColor(tft.color565(255,150,150)); tft.setCursor(4,110); tft.print("Action:");
    tft.setTextColor(ST77XX_WHITE); printWrapped(actionMsg,4,120,76);
  }
  tft.setTextColor(tft.color565(50,50,50));
  tft.setCursor(4,150); tft.print("BTN2:accueil");
}

void printWrapped(String text,int x,int y,int maxW){
  tft.setCursor(x,y); int cx=x,cy=y; String w="";
  for(int i=0;i<=(int)text.length();i++){
    char c=(i<(int)text.length())?text[i]:' ';
    if(c==' '||i==(int)text.length()){
      if(cx+(int)w.length()*6>maxW){cy+=12;cx=x;tft.setCursor(cx,cy);}
      tft.print(w); if(c==' '){tft.print(' ');cx+=(w.length()+1)*6;} w="";
    } else w+=c;
  }
}

// ====================================================================
// PAGE 5 — INFOS SYSTEME
// ====================================================================
void drawPageSysInfo() {
  tft.fillScreen(ST77XX_BLACK);
  tft.fillRect(0,0,80,14,tft.color565(35,0,70));
  tft.setTextColor(ST77XX_WHITE); tft.setTextSize(1);
  tft.setCursor(4,4); tft.print("INFOS SYSTEME");
  tft.drawFastHLine(0,14,80,tft.color565(50,0,100));
  unsigned long up=(millis()-startTime)/1000;
  int y=20;
  drawSysRow(y,"FW:",FW_VERSION,tft.color565(150,100,255)); y+=12;
  drawSysRow(y,"Date:",FW_DATE,tft.color565(120,80,200)); y+=12;
  tft.drawFastHLine(0,y,80,tft.color565(35,35,35)); y+=5;
  drawSysRow(y,"BLE:",bleConnected?"Connecte":"Attente",
    bleConnected?tft.color565(0,200,100):tft.color565(100,100,100)); y+=12;
  String ss="CSQ:"+String(simSignal)+(simSignal>=15?" Bon":simSignal>0?" Fble":" N/A");
  drawSysRow(y,"SIM:",ss,simSignal>=15?tft.color565(0,200,100):tft.color565(255,165,0)); y+=12;
  drawSysRow(y,"GPS:",v.gpsOk?String(v.sats)+" sat":"Recherche",
    v.gpsOk?tft.color565(0,200,100):tft.color565(255,165,0)); y+=12;
  String numS=phoneNumber.length()>0?phoneNumber.substring(max(0,(int)phoneNumber.length()-9)):"N/A";
  drawSysRow(y,"Num:",numS,phoneNumber.length()>0?tft.color565(0,200,100):tft.color565(150,0,0)); y+=12;
  tft.drawFastHLine(0,y,80,tft.color565(35,35,35)); y+=5;
  char ub[12]; sprintf(ub,"%02lu:%02lu:%02lu",up/3600,(up%3600)/60,up%60);
  drawSysRow(y,"Uptime:",ub,tft.color565(120,120,120)); y+=12;
  uint16_t cB=battPercent>50?tft.color565(0,200,100):tft.color565(255,165,0);
  drawSysRow(y,"Batt:",String((int)battPercent)+"%",cB); y+=12;
  tft.setTextColor(tft.color565(55,55,55)); tft.setCursor(4,y+4);
  tft.print("UID:");
  tft.print(patientUID.length()>0?patientUID.substring(0,10)+"..":"Non lie");
  tft.setTextColor(tft.color565(45,45,45));
  tft.setCursor(4,150); tft.print("BTN1:> BTN2:home");
}

void drawSysRow(int y,const char* l,String val,uint16_t c){
  tft.setTextSize(1); tft.setTextColor(tft.color565(90,90,90));
  tft.setCursor(4,y); tft.print(l);
  tft.setTextColor(c); tft.setCursor(44,y); tft.print(val);
}

// ====================================================================
// PAGE 6 — REGLAGES
// ====================================================================
void drawPageReglages() {
  tft.fillScreen(ST77XX_BLACK);
  tft.fillRect(0,0,80,14,tft.color565(0,50,80));
  tft.setTextColor(ST77XX_WHITE); tft.setTextSize(1);
  tft.setCursor(4,4); tft.print("REGLAGES");
  tft.drawFastHLine(0,14,80,tft.color565(0,70,100));

  // Menu principal reglages
  struct { const char* titre; const char* valeur; uint16_t col; } items[] = {
    {"Affichage", themeNames[currentTheme], tft.color565(100,150,255)},
    {"Son",       sonActive  ? "Actif" : "Coupe", sonActive  ? tft.color565(0,200,100):tft.color565(150,0,0)},
    {"Vibration", vibrActive ? "Active": "Coupee",vibrActive ? tft.color565(0,200,100):tft.color565(150,0,0)},
    {"Economie",  econActive ? "Active": "Inactive",econActive? tft.color565(255,165,0):tft.color565(80,80,80)},
    {"A propos",  FW_VERSION, tft.color565(120,80,200)},
  };

  int y=20;
  for(int i=0;i<5;i++){
    // Surligner l'item selectionne
    if(i==regMenu) tft.fillRect(0,y-2,80,16,tft.color565(0,30,60));
    // Fleche selection
    tft.setTextColor(i==regMenu?tft.color565(0,220,180):tft.color565(40,40,40));
    tft.setCursor(2,y); tft.print(i==regMenu?">":" ");
    // Titre
    tft.setTextColor(i==regMenu?ST77XX_WHITE:tft.color565(120,120,120));
    tft.setCursor(12,y); tft.print(items[i].titre);
    // Valeur
    tft.setTextColor(items[i].col);
    tft.setCursor(52,y); tft.print(items[i].valeur);
    y+=18;
  }

  // Aide boutons
  tft.drawFastHLine(0,108,80,tft.color565(30,30,30));
  tft.setTextColor(tft.color565(60,60,60)); tft.setCursor(4,112);
  tft.print("BTN1: suivant");
  tft.setCursor(4,124); tft.print("BTN2: modifier/home");
  tft.setCursor(4,140); tft.print("(Appui long BTN2=home)");
}

// ====================================================================
// SPLASH
// ====================================================================
void showSplash() {
  tft.fillScreen(ST77XX_BLACK);
  for(int y=0;y<160;y++)
    tft.drawFastHLine(0,y,80,tft.color565(0,(int)(y*0.18),(int)(y*0.38)));
  tft.setTextColor(tft.color565(0,220,180)); tft.setTextSize(2);
  tft.setCursor(4,16); tft.println("ASTHMA");
  tft.setCursor(4,38); tft.println("WATCH");
  tft.setTextSize(1); tft.setTextColor(ST77XX_WHITE);
  tft.setCursor(4,66); tft.println("SUPPTIC ENSP 2026");
  tft.setCursor(4,78); tft.print(FW_VERSION);
  tft.setTextColor(tft.color565(0,200,160));
  tft.setCursor(4,96); tft.println("Initialisation...");
  tft.drawRect(4,108,72,7,tft.color565(0,80,80));
  for(int i=0;i<70;i+=2){
    tft.fillRect(5,109,i,5,tft.color565(0,200,160));
    delay(14);
  }
  delay(300);
}

// ====================================================================
// ECRAN APPAIRAGE
// ====================================================================
void showPairingScreen() {
  tft.fillScreen(tft.color565(4,4,18));

  // Header
  tft.fillRect(0,0,80,14,tft.color565(0,70,110));
  tft.setTextColor(ST77XX_WHITE); tft.setTextSize(1);
  tft.setCursor(4,4); tft.print("ASSOCIER MONTRE");

  // Instructions
  tft.setTextColor(tft.color565(140,140,140));
  tft.setCursor(4,18); tft.print("Code d'appairage:");

  // *** CODE EN GRAND SUR 1 LIGNE : ex "123456" ***
  // Taille 2 = 12px par chiffre, 6 chiffres = 72px — tient sur 80px
  tft.setTextSize(2);
  tft.setTextColor(tft.color565(0,220,180));
  // Calculer position centree
  // Chaque chiffre = 12px large en taille 2 + separateur
  // "123 456" = 7 chars × 12px = 84px → trop grand
  // On affiche "123456" sans tiret en taille 2 = 72px → OK
  tft.setCursor(4,32);
  tft.print(pairingCode); // ex: 123456 en gros

  // Tiret au milieu en decoration
  tft.setTextSize(1);
  tft.setTextColor(tft.color565(0,120,100));
  tft.setCursor(4,52);
  tft.print(pairingCode.substring(0,3)+" - "+pairingCode.substring(3,6));

  // Ligne separation
  tft.drawFastHLine(0,64,80,tft.color565(20,20,50));

  // Infos BLE
  tft.setTextColor(tft.color565(60,60,80));
  tft.setCursor(4,70); tft.print("Nom BLE:");
  tft.setTextColor(tft.color565(80,80,120));
  tft.setCursor(4,82); tft.print("AsthmaWatch-"+pairingCode.substring(0,3));

  // Ligne separation
  tft.drawFastHLine(0,94,80,tft.color565(20,20,50));

  // Statut BLE (mis a jour separement par updatePairingStatus)
  tft.setTextSize(1);
  tft.setCursor(4,100);
  tft.setTextColor(tft.color565(80,80,80)); tft.print("Etat: ");
  tft.setTextColor(bleConnected?ST77XX_GREEN:tft.color565(255,165,0));
  tft.print(bleConnected?"Connecte !":"En attente...");

  // Timer restant (10 min)
  unsigned long restant = PAIRING_TIMEOUT_MS - min((unsigned long)PAIRING_TIMEOUT_MS,
                          millis()-pairingStart);
  int minutes = restant/60000;
  int secondes = (restant%60000)/1000;
  tft.setTextColor(tft.color565(50,50,70));
  tft.setCursor(4,114);
  char tbuf[14]; sprintf(tbuf,"Expire dans %02d:%02d",minutes,secondes);
  tft.print(tbuf);

  // Instructions boutons
  tft.drawFastHLine(0,128,80,tft.color565(20,20,40));
  tft.setTextColor(tft.color565(40,40,60));
  tft.setCursor(4,134); tft.print("BTN1: nouveau code");
  tft.setCursor(4,146); tft.print("BTN2: -");
}

void showPairingOK() {
  tft.fillScreen(tft.color565(0,30,15));
  tft.setTextColor(ST77XX_GREEN); tft.setTextSize(2);
  tft.setCursor(8,40); tft.println("ASSOCIE!");
  tft.setTextSize(1); tft.setTextColor(ST77XX_WHITE);
  tft.setCursor(8,70); tft.println("Montre connectee");
  tft.setCursor(8,84); tft.println("a votre compte.");
  if(phoneNumber.length()>0){
    tft.setTextColor(tft.color565(0,180,100));
    tft.setCursor(8,100); tft.print("SMS:"+phoneNumber);
  }
  delay(2500);
  currentPage=PAGE_HOME; drawPage(PAGE_HOME);
}

// ====================================================================
// BOUTONS
// ====================================================================
void handleButtons(unsigned long now) {
  bool btn1 = (digitalRead(PIN_BTN1)==LOW);
  bool btn2 = (digitalRead(PIN_BTN2)==LOW);

  // BTN1 : page suivante OU menu reglages
  if (btn1 && now-lastBtn1>350) {
    lastBtn1 = now;
    if(sonActive) playTone(600,40,20);

    if (currentPage==PAGE_REGLAGES) {
      // Dans reglages : BTN1 = item suivant
      regMenu = (regMenu+1) % REG_TOTAL;
      drawPageReglages();
    } else {
      // Navigation circulaire entre pages
      currentPage = (Page)((currentPage+1) % TOTAL_PAGES);
      drawPage(currentPage);
    }
    while(digitalRead(PIN_BTN1)==LOW);
  }

  // BTN2 : modifier reglage OU retour accueil
  if (btn2 && now-lastBtn2>350) {
    lastBtn2 = now;
    unsigned long pressStart = millis();
    // Attendre relache pour detecter appui long
    while(digitalRead(PIN_BTN2)==LOW && millis()-pressStart<800);
    bool longPress = (millis()-pressStart >= 800);

    if (currentPage==PAGE_REGLAGES && !longPress) {
      // Modifier le parametre selectionne
      if(regMenu==REG_AFFICHAGE){
        currentTheme=(currentTheme+1)%TOTAL_THEMES;
        saveSettings();
      } else if(regMenu==REG_SON){
        sonActive=!sonActive;
        saveSettings();
        if(sonActive) playNotif();
      } else if(regMenu==REG_SON+1){ // Vibration
        vibrActive=!vibrActive;
        saveSettings();
        if(vibrActive){ digitalWrite(PIN_VIBR,HIGH);delay(200);digitalWrite(PIN_VIBR,LOW);}
      } else if(regMenu==REG_ECONOMIE){
        econActive=!econActive;
        saveSettings();
      }
      // REG_APROPOS : rien a modifier
      drawPageReglages();
    } else {
      // Retour accueil
      alertActive   = false;
      currentPage   = PAGE_HOME;
      digitalWrite(PIN_LED,LOW);
      drawPage(PAGE_HOME);
    }
    // Ne pas attendre ici, on a deja attendu la relache
  }
}

// ====================================================================
// SONS
// ====================================================================
void playTone(int freq,int dur,int vol){
  if(!sonActive) return;
  int half=500000/max(freq,1); long fin=millis()+dur;
  while(millis()<fin){
    dac_output_voltage(DAC_CHANNEL_1,vol>50?255:180);
    delayMicroseconds(half);
    dac_output_voltage(DAC_CHANNEL_1,0);
    delayMicroseconds(half);
  }
  dac_output_voltage(DAC_CHANNEL_1,128);
}
void playNotif(){
  playTone(2000,120,70); delay(50);
  playTone(3000,120,70); delay(50);
  playTone(2500,120,70);
}
void playRetourNormal(){
  playTone(800,100,60); delay(40);
  playTone(1200,100,60); delay(40);
  playTone(1600,200,60);
}
void playWarning(){
  for(int i=0;i<3;i++){
    playTone(3000,250,100); delay(80);
    playTone(1500,250,100); delay(80);
  }
}
void playCritique(){
  for(int c=0;c<5;c++){
    for(int f=1500;f<5000;f+=30) playTone(f,5,100);
    for(int f=5000;f>1500;f-=30) playTone(f,5,100);
    delay(30);
  }
}

// ====================================================================
// VIBRATION
// ====================================================================
void vibrate(int ms){
  if(!vibrActive) return;
  digitalWrite(PIN_VIBR,HIGH); delay(ms); digitalWrite(PIN_VIBR,LOW);
}

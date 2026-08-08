/*
 * ================================================================
 * ASTHMA MONITORING WATCH — CODE FINAL COMPLET
 * SUPPTIC · ENSP Yaounde · 2026
 * ================================================================
 * PAGES :
 *   Page 1 — Heure + Date + Resume SpO2/FC
 *   Page 2 — Vitaux detailles
 *   Page 3 — GPS localisation
 *   Page 4 — Conseils / Alerte
 *   Page 5 — Infos systeme
 * ================================================================
 * COMPORTEMENT :
 *   Normal   → silence, affichage vert
 *   Warning  → bips + vibration courte + conseils
 *   Critique → sirene + vibration longue + SMS + conseils
 * ================================================================
 * NAVIGATION :
 *   BTN1 (G32) → page suivante
 *   BTN2 (G34) → retour accueil / acquitter alerte
 * ================================================================
 */

// ===== INCLUDES =====
#include <Wire.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include "MAX30105.h"
#include "spo2_algorithm.h"
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
#define PIN_TFT_CS    5
#define PIN_TFT_DC    2
#define PIN_TFT_RST   15
#define PIN_TFT_MOSI  23
#define PIN_TFT_SCLK  18
#define PIN_DHT       4
#define PIN_SIM_RX    16
#define PIN_SIM_TX    17
#define PIN_GPS_RX    13
#define PIN_GPS_TX    14
#define PIN_DAC       25
#define PIN_VIBR      26
#define PIN_BTN1      32
#define PIN_BTN2      34
#define PIN_LED       33
#define DHT_TYPE      DHT22

// ===== BLE =====
#define BLE_SERVICE_UUID      "4fafc201-1fb5-459e-8fcc-c5c9c3319142"
#define BLE_CHAR_PAIRING_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define BLE_CHAR_UID_UUID     "beb5483e-36e1-4688-b7f5-ea07361b26a9"
#define BLE_CHAR_VITALS_UUID  "beb5483e-36e1-4688-b7f5-ea07361b26aa"

// ===== SEUILS =====
#define SPO2_CRITIQUE   88
#define SPO2_WARNING    92
#define FC_CRITIQUE    120
#define FC_WARNING     100
#define FC_LOW          50
#define TEMP_CRITIQUE   39.5
#define TEMP_FIEVRE     38.0
#define TEMP_HYPOTHERM  35.0
#define HUM_HIGH        80
#define RESP_HIGH       25
#define RESP_WARNING    20
#define RESP_LOW        12

// ===== VERSION =====
#define FW_VERSION "v3.1"
#define FW_DATE    "17/07/2026"

// ===== PAGES =====
enum Page { PAGE_HOME=0, PAGE_VITALS, PAGE_GPS, PAGE_CONSEIL, PAGE_SYSINFO };

// ===== NIVEAUX ALERTE =====
enum AlertLevel { NORMAL=0, WARNING, CRITIQUE };

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
#define TOTAL_THEMES 10

// ===== OBJETS =====
Adafruit_ST7735 tft = Adafruit_ST7735(PIN_TFT_CS, PIN_TFT_DC,
                                       PIN_TFT_MOSI, PIN_TFT_SCLK, PIN_TFT_RST);
MAX30105        ox;
MPU6050         imu;
RTC_DS3231      rtc;
DHT             dht(PIN_DHT, DHT_TYPE);
TinyGPSPlus     gps;
HardwareSerial  SIM(2);
HardwareSerial  GPS_S(1);
Preferences     prefs;

// BLE
BLEServer*         pServer      = nullptr;
BLECharacteristic* pCharPairing = nullptr;
BLECharacteristic* pCharUID     = nullptr;
BLECharacteristic* pCharVitals  = nullptr;
bool bleConnected = false;

// ===== VARIABLES =====
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

struct Vitals {
  int   spo2  = 0;
  int   hr    = 0;
  float temp  = 0;
  float hum   = 0;
  int   resp  = 16;
  float lat   = 0;
  float lng   = 0;
  int   sats  = 0;
  bool  gpsOk = false;
} v;

uint32_t irBuf[100], redBuf[100];
int32_t  spo2Val; int8_t spo2Valid;
int32_t  hrVal;   int8_t hrValid;

unsigned long lastRead    = 0;
unsigned long lastBtn1    = 0;
unsigned long lastBtn2    = 0;
unsigned long lastBLE     = 0;
unsigned long lastSignal  = 0;
unsigned long startTime   = 0;

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
      patientUID  = (sep > 0) ? rx.substring(4, sep) : rx.substring(4);
      phoneNumber = (sep > 0) ? rx.substring(sep + 7) : "";
      prefs.begin("watch", false);
      prefs.putString("uid",   patientUID);
      prefs.putString("phone", phoneNumber);
      prefs.putString("code",  pairingCode);
      prefs.end();
      pairingDone = true;
      pCharPairing->setValue(("OK:" + pairingCode).c_str());
      pCharPairing->notify();
      playNotif();
      showPairingOK();
    }
    if (rx.startsWith("THEME:")) {
      int t = rx.substring(6).toInt();
      if (t >= 0 && t < TOTAL_THEMES) {
        currentTheme = t;
        prefs.begin("watch", false);
        prefs.putInt("theme", t);
        prefs.end();
        if (currentPage == PAGE_HOME) drawPageHome();
      }
    }
  }
};

// ====================================================================
// SETUP
// ====================================================================
void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  SIM.begin(9600,   SERIAL_8N1, PIN_SIM_RX, PIN_SIM_TX);
  GPS_S.begin(9600, SERIAL_8N1, PIN_GPS_RX, PIN_GPS_TX);

  pinMode(PIN_VIBR, OUTPUT);
  pinMode(PIN_BTN1, INPUT_PULLUP);
  pinMode(PIN_BTN2, INPUT_PULLUP);
  pinMode(PIN_LED,  OUTPUT);
  digitalWrite(PIN_VIBR, LOW);
  digitalWrite(PIN_LED,  LOW);

  dac_output_enable(DAC_CHANNEL_1);
  dac_output_voltage(DAC_CHANNEL_1, 128);

  startTime = millis();

  // Ecran
  tft.initR(INITR_MINI160x80);
  tft.setRotation(1);
  showSplash();

  // Preferences sauvegardees
  prefs.begin("watch", true);
  patientUID   = prefs.getString("uid",   "");
  phoneNumber  = prefs.getString("phone", "");
  pairingCode  = prefs.getString("code",  "");
  currentTheme = prefs.getInt("theme", 0);
  prefs.end();

  pairingDone = (patientUID.length() > 0);
  if (!pairingDone) pairingCode = genCode();

  // Init capteurs
  Serial.println("Init capteurs...");
  if (ox.begin(Wire, I2C_SPEED_FAST)) {
    ox.setup();
    ox.setPulseAmplitudeRed(0x0A);
    ox.setPulseAmplitudeGreen(0);
    Serial.println("[OK] MAX30102");
  } else Serial.println("[ERR] MAX30102");

  imu.initialize();
  Serial.println(imu.testConnection() ? "[OK] MPU6050" : "[ERR] MPU6050");

  if (rtc.begin()) {
    if (rtc.lostPower()) rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
    Serial.println("[OK] DS3231");
  } else Serial.println("[ERR] DS3231");

  dht.begin();
  Serial.println("[OK] DHT22");

  // SIM800L
  delay(5000);
  SIM.println("AT+CMGF=1");
  delay(500);
  checkSimSignal();
  Serial.println("[OK] SIM800L signal=" + String(simSignal));

  // BLE
  initBLE();
  Serial.println("[OK] BLE");

  // Sons et vibreur de demarrage
  vibrate(150); delay(100); vibrate(150);
  playNotif();

  Serial.println("=== SYSTEME PRET ===");

  if (pairingDone) drawPage(currentPage);
  else             showPairingScreen();
}

// ====================================================================
// LOOP
// ====================================================================
void loop() {
  unsigned long now = millis();

  // GPS
  while (GPS_S.available()) {
    if (gps.encode(GPS_S.read())) {
      if (gps.location.isValid()) {
        v.lat   = gps.location.lat();
        v.lng   = gps.location.lng();
        v.gpsOk = true;
      }
      v.sats = gps.satellites.value();
    }
  }

  // SIM800L recoit
  while (SIM.available()) Serial.write(SIM.read());

  if (!pairingDone) {
    digitalWrite(PIN_LED, (now/500) % 2);
    handleButtons(now);
    return;
  }

  // Lecture capteurs toutes les 2 secondes
  if (now - lastRead > 2000) {
    readAllSensors();
    analyzeVitals();
    lastRead = now;

    // Declenchement alerte si changement de niveau
    if (currentLevel != lastLevel) {
      triggerAlert();
      lastLevel = currentLevel;
    }

    // Mise a jour affichage
    if (currentPage != PAGE_CONSEIL || currentLevel == NORMAL) {
      drawPage(currentPage);
    }
  }

  // Signal SIM toutes les 15 secondes
  if (now - lastSignal > 15000) {
    checkSimSignal();
    lastSignal = now;
  }

  // BLE toutes les 3 secondes
  if (bleConnected && now - lastBLE > 3000) {
    pCharVitals->setValue(buildJSON().c_str());
    pCharVitals->notify();
    lastBLE = now;
  }

  // Clignotement LED alerte
  if (alertActive) digitalWrite(PIN_LED, (now/300) % 2);

  handleButtons(now);
}

// ====================================================================
// CODE APPAIRAGE
// ====================================================================
String genCode() {
  randomSeed(esp_random());
  return String(random(100000, 999999));
}

// ====================================================================
// BLE
// ====================================================================
void initBLE() {
  String name = "AsthmaWatch-" + pairingCode.substring(0,3);
  BLEDevice::init(name.c_str());
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new WatchBLECallbacks());

  BLEService* svc = pServer->createService(BLE_SERVICE_UUID);

  pCharPairing = svc->createCharacteristic(BLE_CHAR_PAIRING_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pCharPairing->addDescriptor(new BLE2902());
  pCharPairing->setValue(("CODE:" + pairingCode).c_str());

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

// ====================================================================
// LECTURE CAPTEURS
// ====================================================================
void readAllSensors() {
  // MAX30102 SpO2 + FC
  for (byte i = 0; i < 100; i++) {
    while (!ox.available()) ox.check();
    redBuf[i] = ox.getRed();
    irBuf[i]  = ox.getIR();
    ox.nextSample();
  }
  maxim_oxygen_saturation(irBuf, 100, redBuf,
                          &spo2Val, &spo2Valid, &hrVal, &hrValid);
  if (spo2Valid && spo2Val > 0 && spo2Val <= 100) v.spo2 = spo2Val;
  if (hrValid   && hrVal   > 0 && hrVal   <= 250) v.hr   = hrVal;

  // DHT22
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (!isnan(t)) v.temp = t;
  if (!isnan(h)) v.hum  = h;

  // Respiration via MPU6050
  int16_t ax, ay, az, gx, gy, gz;
  imu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);
  static float lastAz = az;
  if (abs(az - lastAz) > 500) v.resp = constrain(v.resp + 1, 8, 40);
  else v.resp = constrain(v.resp - 1, 10, 35);
  lastAz = az;

  // Batterie (estimation simple)
  battPercent = max(0.0f, battPercent - 0.002f);

  Serial.printf("SpO2:%d HR:%d Temp:%.1f Hum:%.0f Resp:%d GPS:%s\n",
    v.spo2, v.hr, v.temp, v.hum, v.resp, v.gpsOk ? "OK" : "...");
}

// ====================================================================
// ANALYSE VITAUX
// ====================================================================
void analyzeVitals() {
  currentLevel = NORMAL;
  alertMsg  = "";
  adviceMsg = "";
  actionMsg = "";

  // ===== CRITIQUE =====
  if (v.spo2 > 0 && v.spo2 < SPO2_CRITIQUE) {
    currentLevel = CRITIQUE;
    alertMsg  = "SpO2 CRITIQUE: " + String(v.spo2) + "%";
    adviceMsg = "Oxygene tres bas! Arretez tout effort.";
    actionMsg = "Appelez le 15 ou 112! Bronchodilatateur si disponible.";
  }
  else if (v.hr > FC_CRITIQUE) {
    currentLevel = CRITIQUE;
    alertMsg  = "Tachycardie: " + String(v.hr) + " bpm";
    adviceMsg = "Rythme cardiaque tres eleve! Asseyez-vous.";
    actionMsg = "Respirez lentement. Appelez medecin si > 5 min.";
  }
  else if (v.temp >= TEMP_CRITIQUE) {
    currentLevel = CRITIQUE;
    alertMsg  = "Fievre critique: " + String(v.temp, 1) + "C";
    adviceMsg = "Fievre dangereuse! Refroidissez-vous.";
    actionMsg = "Paracetamol + eau froide + urgences medicales.";
  }
  else if (v.resp > RESP_HIGH) {
    currentLevel = CRITIQUE;
    alertMsg  = "Detresse resp: " + String(v.resp) + "/min";
    adviceMsg = "Crise d'asthme possible! Restez calme.";
    actionMsg = "Bronchodilatateur immediatement! Appelez le 15.";
  }

  // ===== WARNING =====
  else if (v.spo2 > 0 && v.spo2 < SPO2_WARNING) {
    currentLevel = WARNING;
    alertMsg  = "SpO2 basse: " + String(v.spo2) + "%";
    adviceMsg = "Saturation basse. Respirez profondement.";
    actionMsg = "Installez-vous, evitez l'effort, surveillez.";
  }
  else if (v.hr > FC_WARNING) {
    currentLevel = WARNING;
    alertMsg  = "FC elevee: " + String(v.hr) + " bpm";
    adviceMsg = "Rythme cardiaque eleve. Reposez-vous.";
    actionMsg = "Asseyez-vous, respirez calment 5 minutes.";
  }
  else if (v.hr < FC_LOW && v.hr > 0) {
    currentLevel = WARNING;
    alertMsg  = "Bradycardie: " + String(v.hr) + " bpm";
    adviceMsg = "Rythme cardiaque lent. Restez calme.";
    actionMsg = "Bougez doucement, consultez si persistant.";
  }
  else if (v.temp >= TEMP_FIEVRE) {
    currentLevel = WARNING;
    alertMsg  = "Fievre: " + String(v.temp, 1) + "C";
    adviceMsg = "Temperature elevee. Hydratez-vous.";
    actionMsg = "Paracetamol, repos, eau. Consultez si > 38.5C.";
  }
  else if (v.temp > 0 && v.temp < TEMP_HYPOTHERM) {
    currentLevel = WARNING;
    alertMsg  = "Hypothermie: " + String(v.temp, 1) + "C";
    adviceMsg = "Temperature corporelle basse.";
    actionMsg = "Couvrez-vous, buvez chaud, consultez.";
  }
  else if (v.resp > RESP_WARNING) {
    currentLevel = WARNING;
    alertMsg  = "Resp rapide: " + String(v.resp) + "/min";
    adviceMsg = "Respiration acceleree. Ralentissez.";
    actionMsg = "Respirez 4s/inspire, 4s/expire, 3 fois.";
  }
  else if (v.resp > 0 && v.resp < RESP_LOW) {
    currentLevel = WARNING;
    alertMsg  = "Resp lente: " + String(v.resp) + "/min";
    adviceMsg = "Respiration lente. Respirez activement.";
    actionMsg = "Respirez plus profondement. Surveillez.";
  }
  else if (v.hum > HUM_HIGH) {
    currentLevel = WARNING;
    alertMsg  = "Humidite: " + String((int)v.hum) + "%";
    adviceMsg = "Humidite trop elevee, risque asthme.";
    actionMsg = "Aerez la piece, evitez l'effort physique.";
  }
}

// ====================================================================
// DECLENCHEMENT ALERTE
// ====================================================================
void triggerAlert() {
  if (currentLevel == NORMAL && lastLevel != NORMAL) {
    // Retour a la normale
    alertActive = false;
    digitalWrite(PIN_LED, LOW);
    playRetourNormal();
    vibrate(100);
    currentPage = PAGE_HOME;
    drawPage(PAGE_HOME);
    return;
  }

  alertActive = true;

  if (currentLevel == WARNING) {
    playWarning();
    vibrate(300); delay(100); vibrate(300);
    currentPage = PAGE_CONSEIL;
    drawPage(PAGE_CONSEIL);
  }

  if (currentLevel == CRITIQUE) {
    playCritique();
    for(int i=0; i<5; i++) { vibrate(400); delay(150); }
    sendSMS("[ALERTE ASTHME] " + alertMsg +
            " SpO2:" + String(v.spo2) + "%" +
            " FC:" + String(v.hr) + "bpm" +
            " Temp:" + String(v.temp, 1) + "C" +
            (v.gpsOk ? " GPS:" + String(v.lat,4) + "," + String(v.lng,4) : ""));
    currentPage = PAGE_CONSEIL;
    drawPage(PAGE_CONSEIL);
  }
}

// ====================================================================
// SIGNAL SIM
// ====================================================================
void checkSimSignal() {
  SIM.println("AT+CSQ");
  delay(500);
  String r = "";
  unsigned long t = millis();
  while(millis() - t < 1000) {
    if(SIM.available()) r += (char)SIM.read();
  }
  int idx = r.indexOf("+CSQ: ");
  if (idx >= 0) {
    simSignal = r.substring(idx+6, r.indexOf(",", idx)).toInt();
  }
}

// ====================================================================
// SMS
// ====================================================================
void sendSMS(String msg) {
  if (phoneNumber.length() == 0) return;
  Serial.println("Envoi SMS: " + msg);
  SIM.println("AT+CMGF=1");
  delay(500);
  SIM.println("AT+CMGS=\"" + phoneNumber + "\"");
  delay(1000);
  SIM.print(msg);
  SIM.write(26);
  delay(2000);
}

// ====================================================================
// JSON VITAUX (pour BLE → app)
// ====================================================================
String buildJSON() {
  return "{\"spo2\":" + String(v.spo2) +
         ",\"hr\":"   + String(v.hr) +
         ",\"temp\":" + String(v.temp, 1) +
         ",\"hum\":"  + String((int)v.hum) +
         ",\"resp\":" + String(v.resp) +
         ",\"lat\":"  + String(v.lat, 6) +
         ",\"lng\":"  + String(v.lng, 6) +
         ",\"gps\":"  + (v.gpsOk ? "true" : "false") +
         ",\"batt\":" + String((int)battPercent) +
         ",\"alert\":" + String(currentLevel) + "}";
}

// ====================================================================
// WALLPAPER
// ====================================================================
void drawWallpaper(int idx) {
  const uint16_t* img = themes[idx % TOTAL_THEMES];
  tft.startWrite();
  tft.setAddrWindow(0, 0, 80, 160);
  for (int i = 0; i < 80*160; i++) {
    uint16_t px = pgm_read_word(&img[i]);
    tft.writePixel((px >> 8) | (px << 8));
  }
  tft.endWrite();
}

// ====================================================================
// ROUTEUR PAGES
// ====================================================================
void drawPage(Page p) {
  switch(p) {
    case PAGE_HOME:    drawPageHome();    break;
    case PAGE_VITALS:  drawPageVitals();  break;
    case PAGE_GPS:     drawPageGPS();     break;
    case PAGE_CONSEIL: drawPageConseil(); break;
    case PAGE_SYSINFO: drawPageSysInfo(); break;
  }
}

// ====================================================================
// PAGE 1 — HEURE + DATE + RESUME
// ====================================================================
void drawPageHome() {
  drawWallpaper(currentTheme);

  DateTime now = rtc.now();

  // Zone haut — fond sombre pour lisibilite
  for(int y=0; y<40; y++)
    for(int x=0; x<80; x++)
      tft.drawPixel(x, y, tft.color565(0,0,0));

  // Heure
  tft.setTextSize(2);
  tft.setTextColor(ST77XX_WHITE);
  char timeBuf[6];
  sprintf(timeBuf, "%02d:%02d", now.hour(), now.minute());
  tft.setCursor(4, 4);
  tft.print(timeBuf);
  tft.setTextSize(1);
  tft.setTextColor(tft.color565(150,150,150));
  char sBuf[3];
  sprintf(sBuf, ":%02d", now.second());
  tft.setCursor(58, 10);
  tft.print(sBuf);

  // Date
  tft.setTextColor(tft.color565(200,200,200));
  tft.setCursor(4, 26);
  const char* jours[] = {"Dim","Lun","Mar","Mer","Jeu","Ven","Sam"};
  char dateBuf[14];
  sprintf(dateBuf, "%s %02d/%02d/%04d",
          jours[now.dayOfTheWeek()], now.day(), now.month(), now.year());
  tft.print(dateBuf);

  tft.drawFastHLine(0, 39, 80, tft.color565(60,60,60));

  // SpO2 grande valeur
  uint16_t cSpo2 = (v.spo2 < SPO2_CRITIQUE) ? ST77XX_RED :
                   (v.spo2 < SPO2_WARNING)   ? tft.color565(255,165,0) :
                   tft.color565(0,220,150);
  tft.setTextColor(tft.color565(150,150,150));
  tft.setCursor(4, 46); tft.setTextSize(1); tft.print("SpO2");
  tft.setTextSize(3); tft.setTextColor(cSpo2);
  tft.setCursor(4, 55);
  if (v.spo2 > 0) { tft.print(v.spo2); tft.setTextSize(1); tft.print("%"); }
  else { tft.setTextSize(2); tft.print("--"); }

  // Ligne verticale
  tft.drawFastVLine(52, 44, 32, tft.color565(50,50,50));

  // FC
  uint16_t cHR = (v.hr > FC_CRITIQUE) ? ST77XX_RED :
                 (v.hr > FC_WARNING)   ? tft.color565(255,165,0) :
                 tft.color565(255,100,120);
  tft.setTextColor(tft.color565(150,150,150));
  tft.setCursor(56, 46); tft.setTextSize(1); tft.print("FC");
  tft.setTextSize(2); tft.setTextColor(cHR);
  tft.setCursor(56, 55);
  if (v.hr > 0) tft.print(v.hr);
  else          tft.print("--");
  tft.setTextSize(1);
  tft.setTextColor(tft.color565(120,120,120));
  tft.setCursor(56, 72); tft.print("bpm");

  tft.drawFastHLine(0, 82, 80, tft.color565(50,50,50));

  // Temp + Hum + Resp
  tft.setTextSize(1);
  tft.setTextColor(v.temp >= TEMP_FIEVRE ?
    tft.color565(255,100,0) : tft.color565(100,200,255));
  tft.setCursor(4, 88);
  tft.print("T:"); tft.print(v.temp,1); tft.print("C");

  tft.setTextColor(tft.color565(100,180,255));
  tft.setCursor(42, 88);
  tft.print("H:"); tft.print((int)v.hum); tft.print("%");

  uint16_t cResp = (v.resp > RESP_HIGH || v.resp < RESP_LOW) ?
    tft.color565(255,165,0) : tft.color565(0,200,100);
  tft.setTextColor(cResp);
  tft.setCursor(4, 100);
  tft.print("Resp:"); tft.print(v.resp); tft.print("/min");

  tft.drawFastHLine(0, 112, 80, tft.color565(40,40,40));

  // Status general
  uint16_t sColor;
  const char* sText;
  if      (currentLevel == CRITIQUE) { sColor = ST77XX_RED;             sText = "!!! ALERTE !!!"; }
  else if (currentLevel == WARNING)  { sColor = tft.color565(255,165,0); sText = "! Attention !"; }
  else                                { sColor = tft.color565(0,200,100); sText = "Parametres OK"; }
  tft.setTextColor(sColor);
  tft.setCursor(4, 118); tft.print(sText);

  // Indicateurs BLE / GPS / SIM
  tft.setCursor(4, 130);
  tft.setTextColor(bleConnected ? tft.color565(0,180,100) : tft.color565(60,60,60));
  tft.print("BLE ");
  tft.setTextColor(v.gpsOk ? tft.color565(0,180,100) : tft.color565(60,60,60));
  tft.print("GPS ");
  tft.setTextColor(simSignal > 10 ? tft.color565(0,180,100) :
                   simSignal > 0  ? tft.color565(255,165,0) : tft.color565(60,60,60));
  tft.print("SIM");

  tft.drawFastHLine(0, 142, 80, tft.color565(40,40,40));

  // Theme + navigation
  tft.setTextColor(tft.color565(60,60,60));
  tft.setCursor(4, 148);
  tft.print(themeNames[currentTheme]);
  tft.print(" | BTN1:>");
}

// ====================================================================
// PAGE 2 — VITAUX DETAILLES
// ====================================================================
void drawPageVitals() {
  tft.fillScreen(ST77XX_BLACK);
  tft.fillRect(0, 0, 80, 14, tft.color565(0, 60, 100));
  tft.setTextColor(ST77XX_WHITE); tft.setTextSize(1);
  tft.setCursor(4, 4); tft.print("VITAUX DETAILLES");
  tft.drawFastHLine(0, 14, 80, tft.color565(0,80,120));

  DateTime now = rtc.now();
  tft.setTextColor(tft.color565(80,80,80));
  tft.setCursor(4, 155);
  char tbuf[9];
  sprintf(tbuf, "%02d:%02d:%02d", now.hour(), now.minute(), now.second());
  tft.print(tbuf);

  int y = 22;
  // SpO2
  drawVitalRow(y, "SpO2", String(v.spo2)+"%",
    v.spo2<SPO2_CRITIQUE ? CRITIQUE : v.spo2<SPO2_WARNING ? WARNING : NORMAL,
    "Normal",85,100, v.spo2); y+=22;
  // FC
  drawVitalRow(y, "FC", String(v.hr)+"bpm",
    v.hr>FC_CRITIQUE ? CRITIQUE : v.hr>FC_WARNING ? WARNING : NORMAL,
    "Normal",40,180, v.hr); y+=22;
  // Temp
  drawVitalRow(y, "Temp", String(v.temp,1)+"C",
    v.temp>=TEMP_CRITIQUE ? CRITIQUE : v.temp>=TEMP_FIEVRE ? WARNING : NORMAL,
    v.temp>=TEMP_FIEVRE ? "Fievre" : "Normal",35,42,(int)(v.temp*10)-350); y+=22;
  // Hum
  drawVitalRow(y, "Hum", String((int)v.hum)+"%",
    v.hum>HUM_HIGH ? WARNING : NORMAL,
    "Normal",0,100,(int)v.hum); y+=22;
  // Resp
  drawVitalRow(y, "Resp", String(v.resp)+"/min",
    v.resp>RESP_HIGH ? CRITIQUE : v.resp>RESP_WARNING || v.resp<RESP_LOW ? WARNING : NORMAL,
    "Normal",8,30,v.resp-8); y+=22;

  tft.setTextColor(tft.color565(50,50,50));
  tft.setCursor(46, 155);
  tft.print("BTN1:> BTN2:acc");
}

void drawVitalRow(int y, const char* lbl, String val,
                  AlertLevel lvl, const char* norm,
                  int minV, int maxV, int barVal) {
  if ((y/22)%2==0) tft.fillRect(0,y-2,80,21,tft.color565(8,10,14));

  uint16_t c = (lvl==CRITIQUE) ? ST77XX_RED :
               (lvl==WARNING)  ? tft.color565(255,165,0) :
               tft.color565(0,200,100);

  tft.setTextColor(tft.color565(130,130,130));
  tft.setTextSize(1); tft.setCursor(4,y+1); tft.print(lbl);
  tft.setTextColor(c);
  tft.setCursor(36,y+1); tft.print(val);

  // Barre
  int bw = 30;
  int bf = map(constrain(barVal,0,maxV-minV), 0, maxV-minV, 0, bw);
  tft.drawRect(46,y+9,bw,4,tft.color565(40,40,40));
  tft.fillRect(47,y+10,bf,2,c);

  // Statut
  tft.setTextColor(lvl==NORMAL ? tft.color565(0,160,80) :
                   lvl==WARNING ? tft.color565(255,165,0) : ST77XX_RED);
  tft.setCursor(4,y+11);
  tft.print(lvl==NORMAL ? "OK" : lvl==WARNING ? "!!" : "XX");
}

// ====================================================================
// PAGE 3 — GPS
// ====================================================================
void drawPageGPS() {
  tft.fillScreen(ST77XX_BLACK);
  tft.fillRect(0,0,80,14,tft.color565(0,70,50));
  tft.setTextColor(ST77XX_WHITE); tft.setTextSize(1);
  tft.setCursor(4,4); tft.print("LOCALISATION GPS");
  tft.drawFastHLine(0,14,80,tft.color565(0,100,70));

  if (v.gpsOk) {
    tft.setTextColor(ST77XX_GREEN);
    tft.setCursor(4,20); tft.print("Fix GPS OK!");
    tft.setCursor(48,20); tft.print(v.sats); tft.print(" sat");

    tft.setTextColor(tft.color565(150,150,150));
    tft.setCursor(4,34); tft.print("Latitude:");
    tft.setTextColor(ST77XX_WHITE);
    tft.setCursor(4,46); tft.print(v.lat,6);

    tft.setTextColor(tft.color565(150,150,150));
    tft.setCursor(4,60); tft.print("Longitude:");
    tft.setTextColor(ST77XX_WHITE);
    tft.setCursor(4,72); tft.print(v.lng,6);

    // Mini carte
    int cx=40, cy=110, r=26;
    tft.drawCircle(cx,cy,r,   tft.color565(0,80,60));
    tft.drawCircle(cx,cy,r-7, tft.color565(0,60,40));
    tft.drawFastHLine(cx-r,cy,r*2,tft.color565(20,40,30));
    tft.drawFastVLine(cx,cy-r,r*2,tft.color565(20,40,30));
    tft.fillCircle(cx,cy,3,ST77XX_GREEN);
    tft.drawFastVLine(cx,cy-r,8,ST77XX_GREEN);

    DateTime now = rtc.now();
    tft.setTextColor(tft.color565(70,70,70));
    tft.setCursor(4,148);
    char tbuf[9];
    sprintf(tbuf,"%02d:%02d:%02d",now.hour(),now.minute(),now.second());
    tft.print(tbuf);
  } else {
    tft.setTextColor(tft.color565(255,165,0));
    tft.setCursor(4,22); tft.print("Recherche...");
    tft.setCursor(4,36); tft.print("Sat vus: "); tft.print(v.sats);

    // Animation radar
    int cx=40, cy=90, r=28;
    unsigned long t2 = millis()/400;
    tft.drawCircle(cx,cy,r,   tft.color565(0,80,60));
    tft.drawCircle(cx,cy,r/2, tft.color565(0,60,40));
    tft.drawCircle(cx,cy,r/4, tft.color565(0,50,30));
    float angle = (t2%12) * 30 * PI / 180.0;
    int x2 = cx + r*cos(angle);
    int y2 = cy + r*sin(angle);
    tft.drawLine(cx,cy,x2,y2,tft.color565(0,180,130));

    tft.setTextColor(tft.color565(80,80,80));
    tft.setCursor(4,130); tft.print("Allez pres d'une");
    tft.setCursor(4,142); tft.print("fenetre ouverte.");
  }

  tft.setTextColor(tft.color565(50,50,50));
  tft.setCursor(4,156); tft.print("BTN1:> BTN2:acc");
}

// ====================================================================
// PAGE 4 — CONSEILS / ALERTE
// ====================================================================
void drawPageConseil() {
  uint16_t bg = (currentLevel==CRITIQUE) ? tft.color565(50,0,0) :
                (currentLevel==WARNING)  ? tft.color565(45,25,0) :
                tft.color565(0,25,10);
  tft.fillScreen(bg);

  // Header
  uint16_t hc = (currentLevel==CRITIQUE) ? ST77XX_RED :
                (currentLevel==WARNING)  ? tft.color565(255,165,0) :
                tft.color565(0,200,100);
  tft.fillRect(0,0,80,14,hc);
  tft.setTextColor(ST77XX_BLACK); tft.setTextSize(1);
  tft.setCursor(4,4);
  tft.print(currentLevel==CRITIQUE ? "!!! ALERTE !!!" :
            currentLevel==WARNING  ? "! ATTENTION !" :
            "ETAT NORMAL :)");

  if (currentLevel == NORMAL) {
    tft.setTextColor(tft.color565(0,200,100));
    tft.setCursor(4,22); tft.print("Tous les parametres");
    tft.setCursor(4,34); tft.print("sont dans les normes.");
    tft.setTextColor(ST77XX_WHITE);
    tft.setCursor(4,52); tft.print("SpO2: "); tft.print(v.spo2); tft.print("%");
    tft.setCursor(4,64); tft.print("FC:   "); tft.print(v.hr);   tft.print(" bpm");
    tft.setCursor(4,76); tft.print("Temp: "); tft.print(v.temp,1); tft.print("C");
    tft.setTextColor(tft.color565(0,150,80));
    tft.setCursor(4,96);  tft.print("Continuez vos");
    tft.setCursor(4,108); tft.print("activites normalement.");
  } else {
    // Message alerte
    tft.setTextColor(ST77XX_WHITE);
    tft.setCursor(4,18);
    printWrapped(alertMsg, 4, 18, 76);

    tft.drawFastHLine(0,46,80,tft.color565(80,80,80));

    // Conseil
    tft.setTextColor(tft.color565(255,220,150));
    tft.setCursor(4,52); tft.print("Conseil:");
    tft.setTextColor(ST77XX_WHITE);
    printWrapped(adviceMsg, 4, 62, 76);

    tft.drawFastHLine(0,100,80,tft.color565(80,80,80));

    // Action
    tft.setTextColor(tft.color565(255,150,150));
    tft.setCursor(4,106); tft.print("A faire:");
    tft.setTextColor(ST77XX_WHITE);
    printWrapped(actionMsg, 4, 116, 76);
  }

  tft.setTextColor(tft.color565(50,50,50));
  tft.setCursor(4,150); tft.print("BTN1:> BTN2:accueil");
}

// Texte avec retour ligne automatique
void printWrapped(String text, int x, int y, int maxW) {
  tft.setCursor(x, y);
  int curX=x, curY=y;
  String word="";
  for(int i=0; i<=text.length(); i++) {
    char c=(i<(int)text.length())?text[i]:' ';
    if(c==' '||i==(int)text.length()) {
      if(curX + (int)word.length()*6 > maxW) {
        curY+=12; curX=x; tft.setCursor(curX,curY);
      }
      tft.print(word);
      if(c==' ') { tft.print(' '); curX+=(word.length()+1)*6; }
      word="";
    } else word+=c;
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

  unsigned long uptime = (millis()-startTime)/1000;
  unsigned long h=uptime/3600, m=(uptime%3600)/60, s=uptime%60;

  int y=22;
  drawSysRow(y,"FW:",    FW_VERSION,           tft.color565(150,100,255)); y+=13;
  drawSysRow(y,"Date:",  FW_DATE,              tft.color565(120,80,200));  y+=13;
  tft.drawFastHLine(0,y,80,tft.color565(35,35,35)); y+=6;

  // BLE
  drawSysRow(y,"BLE:",
    bleConnected ? "Connecte" : "Attente...",
    bleConnected ? tft.color565(0,200,100) : tft.color565(100,100,100)); y+=13;

  // SIM
  String simStr = "CSQ:" + String(simSignal);
  simStr += (simSignal>=20)?" Excl":(simSignal>=15)?" Bon":(simSignal>0)?" Fble":" N/A";
  drawSysRow(y,"SIM:", simStr,
    (simSignal>=15)?tft.color565(0,200,100):
    (simSignal>0)?tft.color565(255,165,0):tft.color565(150,0,0)); y+=13;

  // GPS
  drawSysRow(y,"GPS:",
    v.gpsOk ? (String(v.sats)+" sat") : "Recherche",
    v.gpsOk ? tft.color565(0,200,100) : tft.color565(255,165,0)); y+=13;

  tft.drawFastHLine(0,y,80,tft.color565(35,35,35)); y+=6;

  // Uptime
  char uptBuf[10];
  sprintf(uptBuf,"%02lu:%02lu:%02lu",h,m,s);
  drawSysRow(y,"Uptime:", uptBuf, tft.color565(120,120,120)); y+=13;

  // Batterie
  uint16_t cBatt=(battPercent>50)?tft.color565(0,200,100):
                 (battPercent>20)?tft.color565(255,165,0):ST77XX_RED;
  drawSysRow(y,"Batt:", String((int)battPercent)+"%", cBatt); y+=13;

  // Theme
  drawSysRow(y,"Theme:", themeNames[currentTheme],
    tft.color565(100,150,200)); y+=13;

  tft.drawFastHLine(0,y,80,tft.color565(35,35,35)); y+=6;

  // UID
  tft.setTextColor(tft.color565(55,55,55));
  tft.setCursor(4,y);
  tft.print("UID: ");
  tft.print(patientUID.length()>0 ? patientUID.substring(0,8)+"..." : "Non lie");

  tft.setTextColor(tft.color565(45,45,45));
  tft.setCursor(4,150); tft.print("BTN1:acc BTN2:acc");
}

void drawSysRow(int y, const char* lbl, String val, uint16_t col) {
  tft.setTextSize(1);
  tft.setTextColor(tft.color565(90,90,90));
  tft.setCursor(4,y); tft.print(lbl);
  tft.setTextColor(col);
  tft.setCursor(42,y); tft.print(val);
}

// ====================================================================
// SPLASH + APPAIRAGE
// ====================================================================
void showSplash() {
  tft.fillScreen(ST77XX_BLACK);
  for(int y=0; y<160; y++)
    tft.drawFastHLine(0,y,80,tft.color565(0,(int)(y*0.18),(int)(y*0.38)));

  tft.setTextColor(tft.color565(0,220,180));
  tft.setTextSize(2); tft.setCursor(4,18); tft.println("ASTHMA");
  tft.setCursor(4,40); tft.println("WATCH");
  tft.setTextSize(1);
  tft.setTextColor(ST77XX_WHITE);
  tft.setCursor(4,68); tft.println("SUPPTIC · ENSP");
  tft.setCursor(4,80); tft.println("Yaounde · 2026");
  tft.setTextColor(tft.color565(80,80,80));
  tft.setCursor(4,94); tft.print(FW_VERSION " · " FW_DATE);

  tft.drawRect(4,110,72,7,tft.color565(0,80,80));
  for(int i=0; i<70; i+=2) {
    tft.fillRect(5,111,i,5,tft.color565(0,200,160));
    delay(18);
  }
  tft.setTextColor(tft.color565(0,200,160));
  tft.setCursor(4,126); tft.println("Initialisation...");
  delay(400);
}

void showPairingScreen() {
  tft.fillScreen(tft.color565(4,4,18));
  tft.fillRect(0,0,80,14,tft.color565(0,70,110));
  tft.setTextColor(ST77XX_WHITE); tft.setTextSize(1);
  tft.setCursor(4,4); tft.println("ASSOCIER MONTRE");

  tft.setTextColor(tft.color565(140,140,140));
  tft.setCursor(4,20); tft.println("Ouvrez l'app puis");
  tft.setCursor(4,32); tft.println("entrez ce code:");

  tft.setTextSize(2);
  tft.setTextColor(tft.color565(0,220,180));
  tft.setCursor(4,48);
  tft.print(pairingCode.substring(0,3));
  tft.print("-");
  tft.println(pairingCode.substring(3,6));

  tft.setTextSize(1);
  tft.setTextColor(tft.color565(80,80,80));
  tft.setCursor(4,74); tft.print("BLE: ");
  tft.setTextColor(bleConnected ? ST77XX_GREEN : tft.color565(255,165,0));
  tft.println(bleConnected ? "Connecte" : "En attente...");

  tft.setTextColor(tft.color565(60,60,60));
  tft.setCursor(4,90);  tft.println("Nom BLE:");
  tft.setCursor(4,102); tft.print("AsthmaWatch-");
  tft.println(pairingCode.substring(0,3));

  tft.setTextColor(tft.color565(45,45,45));
  tft.setCursor(4,130); tft.println("BTN1: Nouveau code");
  tft.setCursor(4,144); tft.println("BTN2: Retour");
}

void showPairingOK() {
  tft.fillScreen(tft.color565(0,30,15));
  tft.setTextColor(ST77XX_GREEN); tft.setTextSize(2);
  tft.setCursor(8,45); tft.println("Associe!");
  tft.setTextSize(1); tft.setTextColor(ST77XX_WHITE);
  tft.setCursor(8,74); tft.println("Montre liee a");
  tft.setCursor(8,86); tft.println("votre compte.");
  vibrate(200); delay(100); vibrate(200);
  delay(2000);
  currentPage = PAGE_HOME;
  drawPage(PAGE_HOME);
}

// ====================================================================
// BOUTONS
// ====================================================================
void handleButtons(unsigned long now) {
  if (digitalRead(PIN_BTN1) == LOW && now - lastBtn1 > 300) {
    lastBtn1 = now;
    playTone(600, 40, 30);

    if (!pairingDone) {
      pairingCode = genCode();
      prefs.begin("watch", false);
      prefs.putString("code", pairingCode);
      prefs.end();
      showPairingScreen();
      while(digitalRead(PIN_BTN1)==LOW);
      return;
    }

    // Navigation circulaire 5 pages
    switch(currentPage) {
      case PAGE_HOME:    currentPage=PAGE_VITALS;  break;
      case PAGE_VITALS:  currentPage=PAGE_GPS;     break;
      case PAGE_GPS:     currentPage=PAGE_CONSEIL; break;
      case PAGE_CONSEIL: currentPage=PAGE_SYSINFO; break;
      case PAGE_SYSINFO: currentPage=PAGE_HOME;    break;
    }
    drawPage(currentPage);
    while(digitalRead(PIN_BTN1)==LOW);
  }

  if (digitalRead(PIN_BTN2) == LOW && now - lastBtn2 > 300) {
    lastBtn2 = now;
    alertActive   = false;
    currentPage   = PAGE_HOME;
    digitalWrite(PIN_LED, LOW);
    drawPage(PAGE_HOME);
    while(digitalRead(PIN_BTN2)==LOW);
  }
}

// ====================================================================
// SONS
// ====================================================================
void playTone(int freq, int dur, int vol) {
  int half = 500000 / max(freq,1);
  long fin = millis() + dur;
  while(millis()<fin) {
    dac_output_voltage(DAC_CHANNEL_1, vol>50?255:180);
    delayMicroseconds(half);
    dac_output_voltage(DAC_CHANNEL_1, 0);
    delayMicroseconds(half);
  }
  dac_output_voltage(DAC_CHANNEL_1, 128);
}

void playNotif() {
  playTone(2000,120,70); delay(50);
  playTone(3000,120,70); delay(50);
  playTone(2500,120,70);
}

void playRetourNormal() {
  playTone(800,100,60);  delay(40);
  playTone(1200,100,60); delay(40);
  playTone(1600,200,60);
}

void playWarning() {
  for(int i=0;i<3;i++) {
    playTone(3000,250,100); delay(80);
    playTone(1500,250,100); delay(80);
  }
}

void playCritique() {
  for(int c=0;c<5;c++) {
    for(int f=1500;f<5000;f+=30) playTone(f,5,100);
    for(int f=5000;f>1500;f-=30) playTone(f,5,100);
    delay(30);
  }
}

// ====================================================================
// VIBRATIONS
// ====================================================================
void vibrate(int ms) {
  digitalWrite(PIN_VIBR, HIGH);
  delay(ms);
  digitalWrite(PIN_VIBR, LOW);
}

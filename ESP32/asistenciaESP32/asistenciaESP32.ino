#include <qrcode.h>
#include <WiFi.h>
#include <WiFiMulti.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <U8g2lib.h>
#include <SPI.h>

// --- CONFIGURACIÓN DE PINES ESP32 ---
// En ESP32 se usan directamente los números de GPIO (G en la placa)
#define HX1230_CLK 18  // G18
#define HX1230_DIN 23  // G23
#define HX1230_CS  5   // G5
#define HX1230_RST 4   // G4
#define PIN_LUZ    15  // G15 (Backlight / BL)

// Constructor U8g2 para HX1230 (Software SPI para flexibilidad)
U8G2_HX1230_96X68_F_3W_SW_SPI u8g2(U8G2_R0, HX1230_CLK, HX1230_DIN, HX1230_CS, HX1230_RST);

// Instancia Multi-WiFi
WiFiMulti wifiMulti;

// Listado de redes configuradas para el diagnóstico
const char* targetSSIDs[] = {"EST UTN", "UTN-EST2", "EST-UTN3", "CASA 2.4"};
const int numTargetNetworks = 4;

// Supabase
const char* supabaseUrl = "https://gywcfuqrwubjqiowhbsn.supabase.co/rest/v1/qr_tokens";
const char* supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5d2NmdXFyd3VianFpb3doYnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDEwMTcsImV4cCI6MjA4OTE3NzAxN30.yWLjbFxnMzZt-zEmyZYHhwotzVXlINRH0fo9lxpXoME";

unsigned long lastUpdate = 0;
const long updateInterval = 10000; // 10 segundos

void diagnosticoWiFi() {
  Serial.println("\n--- ESCANEANDO REDES WIFI (ESP32) ---");
  int n = WiFi.scanNetworks();
  if (n == 0) {
    Serial.println("No se encontraron redes WiFi.");
  } else {
    Serial.print(n);
    Serial.println(" redes encontradas:");
    for (int i = 0; i < n; ++i) {
      String currentSSID = WiFi.SSID(i);
      Serial.print(i + 1);
      Serial.print(": ");
      Serial.print(currentSSID);
      
      bool isMatch = false;
      for (int j = 0; j < numTargetNetworks; j++) {
        if (currentSSID == targetSSIDs[j]) {
          isMatch = true;
          break;
        }
      }
      
      if (isMatch) {
        Serial.print(" [MATCH!] ");
      }
      
      Serial.print(" (");
      Serial.print(WiFi.RSSI(i));
      Serial.print(" dBm) ");
      Serial.println(WiFi.encryptionType(i) == WIFI_AUTH_OPEN ? "Abierta" : "Protegida");
      delay(10);
    }
  }
  Serial.println("--- FIN ESCANEO ---\n");
}

void setup() {  
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n\n--- INICIANDO FIRMWARE ASISTENCIA (ESP32) ---");
  
  diagnosticoWiFi(); // Escanear redes antes de intentar conectar
  
  pinMode(PIN_LUZ, OUTPUT);
  digitalWrite(PIN_LUZ, HIGH); // Encender Backlight (BL)

  u8g2.begin();
  u8g2.setContrast(150); 
  u8g2.setFont(u8g2_font_6x10_tf);
  
  u8g2.clearBuffer();
  u8g2.drawStr(5, 34, "ESP32 Conectando...");
  u8g2.sendBuffer();

  // Configurar lista de redes prioritarias (Actualizado con tus redes)
  wifiMulti.addAP("EST UTN", "ObiWan2025");
  wifiMulti.addAP("UTN-EST2", "Isi12345");
  wifiMulti.addAP("EST-UTN3", "Isi12345");
  wifiMulti.addAP("CASA 2.4", "12345casa");

  Serial.println("Esperando conexión WiFi...");
  while (wifiMulti.run() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
  }
  
  Serial.println("\nWiFi conectado a: " + WiFi.SSID());
  Serial.println("IP: " + WiFi.localIP().toString());
  
  u8g2.clearBuffer();
  u8g2.drawStr(15, 34, "ESP32 WiFi OK!");
  u8g2.sendBuffer();
  delay(1000);
}

void loop() {
  if (wifiMulti.run() == WL_CONNECTED) {
    if (millis() - lastUpdate >= updateInterval || lastUpdate == 0) {
      lastUpdate = millis();
      Serial.println("\n--- ESP32: Pidiendo nuevo token ---");
      
      String tokenActivo = "qr_" + String(random(10000, 99999)) + "_" + String(millis());
      
      WiFiClientSecure client;
      client.setInsecure(); 
      
      String fullUrl = String(supabaseUrl) + "?apikey=" + String(supabaseKey);
      
      HTTPClient http;
      http.begin(client, fullUrl);
      http.addHeader("Content-Type", "application/json");
      http.addHeader("Authorization", "Bearer " + String(supabaseKey));
      
      String payload = "{\"token\":\"" + tokenActivo + "\"}";
      int httpResponseCode = http.POST(payload);
      
      if (httpResponseCode == 201) {
        Serial.print("SUCCESS: QR guardado. Code: ");
        Serial.println(httpResponseCode);
        mostrarQR(tokenActivo);
      } else {
        Serial.print("ERROR SUPABASE Status: ");
        Serial.println(httpResponseCode);
        
        u8g2.clearBuffer();
        u8g2.drawStr(5, 30, "Error Supabase");
        u8g2.setCursor(5, 50);
        u8g2.print("Status: ");
        u8g2.print(httpResponseCode);
        u8g2.sendBuffer();
      }
      http.end();
    }
  } else {
    Serial.println("WiFi perdido. Reconectando...");
    u8g2.clearBuffer();
    u8g2.drawStr(5, 34, "Reconectando...");
    u8g2.sendBuffer();
    delay(5000);
  }
}

void mostrarQR(String texto) {
  QRCode qrcode;
  uint8_t qrcodeData[qrcode_getBufferSize(3)];
  qrcode_initText(&qrcode, qrcodeData, 3, 0, texto.c_str());

  u8g2.clearBuffer();
  int scale = 2; 
  int startX = (96 - (qrcode.size * scale)) / 2;
  int startY = (68 - (qrcode.size * scale)) / 2;

  u8g2.setDrawColor(1);
  for (uint8_t y = 0; y < qrcode.size; y++) {
    for (uint8_t x = 0; x < qrcode.size; x++) {
      if (qrcode_getModule(&qrcode, x, y)) {
        u8g2.drawBox(startX + (x * scale), startY + (y * scale), scale, scale);
      }
    }
  }
  u8g2.sendBuffer();
  Serial.println("QR en pantalla: " + texto);
}

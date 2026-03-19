#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <U8g2lib.h>
#include <SPI.h>
#include <qrcode.h>

// Configuración de la pantalla gráfica HX1230 (96x68)
// Pines SPI (Software SPI 3-wire)
#define HX1230_CLK 14
#define HX1230_DIN 13
#define HX1230_CS  15
#define HX1230_RST 2

#define PIN_LUZ D1 

// Constructor U8g2 para HX1230
U8G2_HX1230_96X68_F_3W_SW_SPI u8g2(U8G2_R0, HX1230_CLK, HX1230_DIN, HX1230_CS, HX1230_RST);

// WiFi
const char* ssid = "EST UTN";
const char* password = "ObiWan2025";

// Supabase
const char* supabaseUrl = "https://gywcfuqrwubjqiowhbsn.supabase.co/rest/v1/qr_tokens";
const char* supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5d2NmdXFyd3VianFpb3doYnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDEwMTcsImV4cCI6MjA4OTE3NzAxN30.yWLjbFxnMzZt-zEmyZYHhwotzVXlINRH0fo9lxpXoME";

unsigned long lastUpdate = 0;
const long updateInterval = 10000; // 10 segundos

void diagnosticoWiFi() {
  Serial.println("\n--- ESCANEANDO REDES WIFI (2.4GHz) ---");
  // WiFi.scanNetworks() devolverá el número de redes encontradas
  int n = WiFi.scanNetworks();
  if (n == 0) {
    Serial.println("No se encontraron redes WiFi. Verifica que haya redes de 2.4GHz cerca.");
  } else {
    Serial.print(n);
    Serial.println(" redes encontradas:");
    for (int i = 0; i < n; ++i) {
      String currentSSID = WiFi.SSID(i);
      Serial.print(i + 1);
      Serial.print(": ");
      Serial.print(currentSSID);
      
      if (currentSSID == ssid) {
        Serial.print(" [MATCH!] ");
      }
      
      Serial.print(" (");
      Serial.print(WiFi.RSSI(i));
      Serial.print(" dBm) ");
      Serial.println((WiFi.encryptionType(i) == ENC_TYPE_NONE) ? "Abierta" : "Protegida");
      delay(10);
    }
  }
  Serial.println("--- FIN ESCANEO ---\n");
}

void setup() {  
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n\n--- INICIANDO FIRMWARE ASISTENCIA ---");
  Serial.println("Puerto Serie OK a 115200 baudios");
  
  diagnosticoWiFi(); // Escanear redes antes de intentar conectar
  
  pinMode(PIN_LUZ, OUTPUT);
  digitalWrite(PIN_LUZ, HIGH); 

  u8g2.begin();
  u8g2.setContrast(150); 
  u8g2.setFont(u8g2_font_6x10_tf);
  
  u8g2.clearBuffer();
  u8g2.drawStr(10, 34, "Conectando...");
  u8g2.sendBuffer();

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("\nWiFi conectado!");
  
  u8g2.clearBuffer();
  u8g2.drawStr(25, 34, "WiFi OK!");
  u8g2.sendBuffer();
  delay(1000);
}

void loop() {
  if (millis() - lastUpdate >= updateInterval || lastUpdate == 0) {
    lastUpdate = millis();
    Serial.println("\n--- Intentando obtener nuevo token ---");
    
    String tokenActivo = "qr_" + String(random(10000, 99999)) + "_" + String(millis());
    
    if(WiFi.status() == WL_CONNECTED) {
      WiFiClientSecure client;
      client.setInsecure(); 
      
      String fullUrl = String(supabaseUrl) + "?apikey=" + String(supabaseKey);
      
      HTTPClient http;
      http.begin(client, fullUrl);
      http.addHeader("Content-Type", "application/json");
      http.addHeader("Authorization", "Bearer " + String(supabaseKey));
      http.addHeader("Prefer", "return=representation");
      
      String payload = "{\"token\":\"" + tokenActivo + "\"}";
      int httpResponseCode = http.POST(payload);
      
      if (httpResponseCode == 201) {
        Serial.print("SUCCESS: QR guardado en Supabase. Code: ");
        Serial.println(httpResponseCode);
        mostrarQR(tokenActivo);
      } else {
        String responseBody = http.getString();
        Serial.print("ERROR SUPABASE Status: ");
        Serial.println(httpResponseCode);
        Serial.println("Cuerpo de respuesta: " + responseBody);
        
        u8g2.clearBuffer();
        u8g2.setCursor(5, 20);
        u8g2.print("Error Supabase");
        u8g2.setCursor(5, 40);
        u8g2.print("Status: ");
        u8g2.print(httpResponseCode);
        u8g2.setCursor(5, 55);
        u8g2.print("Reintentando...");
        u8g2.sendBuffer();
      }
      http.end();
    } else {
      Serial.println("WiFi desconectado!");
    }
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
  Serial.println("QR mostrado: " + texto);
}

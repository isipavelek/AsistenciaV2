#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <U8g2lib.h>
#include <qrcode.h>

// Configuración de la pantalla SH1106 por I2C
U8G2_SH1106_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE);

// Cambia estos datos por los de tu red WiFi
const char* ssid = "Isi_WiFi_2.4G";
const char* password = "12345casa";

// Supabase - Asegúrate de que los datos son correctos
const char* supabaseUrl = "https://gywcfuqrwubjqiowhbsn.supabase.co/rest/v1/qr_tokens";
const char* supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5d2NmdXFyd3VianFpb3doYnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDEwMTcsImV4cCI6MjA4OTE3NzAxN30.yWLjbFxnMzZt-zEmyZYHhwotzVXlINRH0fo9lxpXoME";

unsigned long lastUpdate = 0;
const long updateInterval = 10000; // 10 segundos

void setup() {
  Serial.begin(115200);
  u8g2.begin();
  
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_ncenB08_tr);
  u8g2.drawStr(0, 20, "Conectando WiFi...");
  u8g2.sendBuffer();

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("");
  Serial.println("WiFi conectado");
  
  u8g2.clearBuffer();
  u8g2.drawStr(0, 20, "WiFi OK!");
  u8g2.sendBuffer();
  delay(1000);
}

void loop() {
  if (millis() - lastUpdate >= updateInterval || lastUpdate == 0) {
    lastUpdate = millis();
    
    // Generar un token único: sufijo + número aleatorio + millis
    String tokenActivo = "qr_" + String(random(10000, 99999)) + "_" + String(millis());
    
    // Subir a Supabase
    if(WiFi.status() == WL_CONNECTED) {
      WiFiClientSecure client;
      client.setInsecure(); // No verificamos el certificado SSL por simplicidad (ESP8266)
      
      HTTPClient http;
      http.begin(client, supabaseUrl);
      http.addHeader("Content-Type", "application/json");
      http.addHeader("apikey", supabaseKey);
      http.addHeader("Authorization", String("Bearer ") + supabaseKey);
      http.addHeader("Prefer", "return=representation");
      
      String payload = "{\"token\":\"" + tokenActivo + "\"}";
      int httpResponseCode = http.POST(payload);
      
      if (httpResponseCode > 0) {
        Serial.print("HTTP POST OK, Code: ");
        Serial.println(httpResponseCode);
        mostrarQR(tokenActivo);
      } else {
        Serial.print("Error en HTTP POST: ");
        Serial.println(http.errorToString(httpResponseCode).c_str());
        
        // Si hay error, mostrar en pantalla
        u8g2.clearBuffer();
        u8g2.setFont(u8g2_font_ncenB08_tr);
        u8g2.drawStr(10, 30, "Error API");
        u8g2.sendBuffer();
      }
      http.end();
    }
  }
}

void mostrarQR(String texto) {
  QRCode qrcode;
  uint8_t qrcodeData[qrcode_getBufferSize(3)];
  qrcode_initText(&qrcode, qrcodeData, 3, 0, texto.c_str());

  u8g2.clearBuffer();
  
  int scale = 2;
  int startX = (128 - (qrcode.size * scale)) / 2;
  int startY = (64 - (qrcode.size * scale)) / 2;

  // Fondo blanco (para que la app cámara lo lea rápido)
  u8g2.setDrawColor(1);
  u8g2.drawBox(startX - 2, startY - 2, (qrcode.size * scale) + 4, (qrcode.size * scale) + 4);

  // Cuadritos del QR negros
  u8g2.setDrawColor(0);
  for (uint8_t y = 0; y < qrcode.size; y++) {
    for (uint8_t x = 0; x < qrcode.size; x++) {
      if (qrcode_getModule(&qrcode, x, y)) {
        u8g2.drawBox(startX + (x * scale), startY + (y * scale), scale, scale);
      }
    }
  }
  
  u8g2.sendBuffer();
  Serial.println("Nuevo QR mostrado: " + texto);
}

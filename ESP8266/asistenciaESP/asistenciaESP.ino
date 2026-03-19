#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <U8g2lib.h>
#include <SPI.h>
#include <qrcode.h>

// Configuración de la pantalla gráfica HX1230 (96x68)
// Pines SPI (Software SPI 3-wire) - Compatibles con la conexión anterior:
// SCK/CLK  -> D5 (GPIO 14)
// SDA/DIN  -> D7 (GPIO 13)
// CS/CE    -> D8 (GPIO 15)
// RES/RST  -> D4 (GPIO 2)
// (El pin DC/A0 conectado a D3 ya no es necesario)
#define HX1230_CLK 14
#define HX1230_DIN 13
#define HX1230_CS  15
#define HX1230_RST 2

#define PIN_LUZ D1 // (O el pin que elijas)


// Constructor U8g2 para HX1230 (Framebuffer en RAM, Software SPI 3 hilos)
U8G2_HX1230_96X68_F_3W_SW_SPI u8g2(U8G2_R0, HX1230_CLK, HX1230_DIN, HX1230_CS, HX1230_RST);

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
  pinMode(PIN_LUZ, OUTPUT);
  digitalWrite(PIN_LUZ, HIGH); // Para encenderla al inicio
  // Inicializa la pantalla HX1230
  u8g2.begin();
  u8g2.setContrast(150); // <-- Sube este valor (hasta 255) si quieres los píxeles más "fuertes"/oscuros
  u8g2.setFont(u8g2_font_6x10_tf);
  
  u8g2.clearBuffer();
  u8g2.drawStr(10, 34, "Conectando...");
  u8g2.sendBuffer();

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("");
  Serial.println("WiFi conectado");
  
  u8g2.clearBuffer();
  u8g2.drawStr(25, 34, "WiFi OK!");
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
        u8g2.drawStr(20, 34, "Error API");
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
  
  // La pantalla HX1230 usa una resolución de 96x68
  // QR version 3 tiene 29x29 módulos.
  int scale = 2; // Escala 2 ocupa 58x58 píxeles
  int startX = (96 - (qrcode.size * scale)) / 2;
  int startY = (68 - (qrcode.size * scale)) / 2;

  // En pantallas monocromas, dibujamos directamente los módulos (color 1)
  u8g2.setDrawColor(1);

  // Cuadritos del QR
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

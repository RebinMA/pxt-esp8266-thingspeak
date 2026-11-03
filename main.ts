// iotlab demo: send temperature and light level to ThingSpeak
// Wiring: ESP8266 TX -> P8, ESP8266 RX -> P12, 3V and GND (ESP8266 at 115200 baud)
// Fill in your WiFi name/password and your ThingSpeak channel's Write API Key.
let writeKey = "H1ADHALQJ2LMQF73"
let ssid = "CED-15"
let password = "12345678"
basic.showIcon(IconNames.SmallDiamond)
iotlab.connectWifi(ssid, password)
if (iotlab.isWifiConnected()) {
    basic.showIcon(IconNames.Yes)
} else {
    basic.showIcon(IconNames.No)
}
basic.pause(1000)
basic.forever(function () {
    if (!(iotlab.isWifiConnected())) {
        // try again if WiFi dropped or the first attempt failed
        basic.showIcon(IconNames.SmallDiamond)
        iotlab.connectWifi(ssid, password)
    }
    if (iotlab.isWifiConnected()) {
        basic.showIcon(IconNames.SmallSquare)
        iotlab.upload(
        writeKey,
        input.temperature(),
        Environment.ReadLightIntensity(AnalogPin.P1)
        )
        if (iotlab.lastUploadOk()) {
            basic.showIcon(IconNames.Yes)
            basic.showNumber(iotlab.lastEntryId())
        } else {
            basic.showIcon(IconNames.Sad)
        }
    } else {
        basic.showIcon(IconNames.No)
    }
    basic.pause(20000)
})

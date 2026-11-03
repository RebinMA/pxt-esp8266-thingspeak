namespace iotlab {
    let wifiOk = false
    let lastOk = false
    let lastEntry = 0
    let lastUploadTime = 0
    let hasUploaded = false

    // Read from the ESP8266 until one of the targets appears or the timeout passes.
    // Keeps only the tail of the reply to save memory on micro:bit V1.
    function waitFor(targets: string[], timeout: number): string {
        let resp = ""
        let start = input.runningTime()
        while (input.runningTime() - start < timeout) {
            resp += serial.readString()
            if (resp.length > 400) resp = resp.substr(resp.length - 400)
            for (let t of targets) {
                if (resp.indexOf(t) >= 0) return resp
            }
            basic.pause(20)
        }
        return resp
    }

    function sendAT(cmd: string, targets: string[], timeout: number): string {
        serial.readString() // flush
        serial.writeString(cmd + "\r\n")
        return waitFor(targets, timeout)
    }

    /**
     * Start the ESP8266 and join a 2.4 GHz WiFi network. Retries up to 3 times.
     */
    //% block="connect to WiFi|SSID %ssid|password %password"
    //% weight=100
    export function connectWifi(ssid: string, password: string): void {
        serial.setRxBufferSize(254)
        serial.redirect(SerialPin.P8, SerialPin.P12, BaudRate.BaudRate115200)
        basic.pause(1000)
        sendAT("AT", ["OK"], 1000)
        sendAT("AT+CWMODE=1", ["OK", "ERROR"], 1000)
        wifiOk = false
        for (let attempt = 0; attempt < 3 && !wifiOk; attempt++) {
            let r = sendAT("AT+CWJAP=\"" + ssid + "\",\"" + password + "\"", ["OK", "FAIL", "ERROR"], 20000)
            wifiOk = r.indexOf("GOT IP") >= 0 || r.indexOf("OK") >= 0
            if (r.indexOf("FAIL") >= 0 || r.indexOf("ERROR") >= 0) wifiOk = false
            if (!wifiOk) basic.pause(2000)
        }
        sendAT("AT+CIPMUX=0", ["OK", "ERROR"], 1000)
    }

    /**
     * Upload up to 4 values to a ThingSpeak channel.
     * Automatically waits so uploads are at least 15 s apart (free-account limit).
     */
    //% block="upload to ThingSpeak|write key %key|field1 %f1||field2 %f2|field3 %f3|field4 %f4"
    //% expandableArgumentMode="enabled" inlineInputMode=external
    //% weight=90
    export function upload(key: string, f1: number, f2?: number, f3?: number, f4?: number): void {
        lastOk = false
        lastEntry = 0
        if (!wifiOk) return

        if (hasUploaded) {
            let wait = 15500 - (input.runningTime() - lastUploadTime)
            if (wait > 0) basic.pause(wait)
        }

        let query = "api_key=" + key + "&field1=" + f1
        if (f2 !== undefined) query += "&field2=" + f2
        if (f3 !== undefined) query += "&field3=" + f3
        if (f4 !== undefined) query += "&field4=" + f4

        let s = sendAT("AT+CIPSTART=\"TCP\",\"api.thingspeak.com\",80", ["CONNECT", "ERROR", "CLOSED"], 10000)
        if (s.indexOf("CONNECT") < 0) {
            sendAT("AT+CIPCLOSE", ["OK", "ERROR"], 1000)
            return
        }

        let req = "GET /update?" + query + " HTTP/1.1\r\nHost: api.thingspeak.com\r\nConnection: close\r\n\r\n"
        s = sendAT("AT+CIPSEND=" + req.length, [">", "ERROR"], 3000)
        if (s.indexOf(">") < 0) {
            sendAT("AT+CIPCLOSE", ["OK", "ERROR"], 1000)
            return
        }

        serial.readString()
        serial.writeString(req)
        s = waitFor(["CLOSED"], 10000)
        hasUploaded = true
        lastUploadTime = input.runningTime()

        // Body comes after the blank line that ends the headers; ThingSpeak returns the entry id (0 = rejected)
        // find the LAST blank line (MakeCode strings have no lastIndexOf)
        let bodyStart = -1
        let p = s.indexOf("\r\n\r\n")
        while (p >= 0) {
            bodyStart = p
            p = s.indexOf("\r\n\r\n", p + 1)
        }
        if (bodyStart < 0) return
        let id = 0
        let i = bodyStart + 4
        while (i < s.length && (s.charAt(i) == "\r" || s.charAt(i) == "\n" || s.charAt(i) == " ")) i++
        while (i < s.length) {
            let c = s.charCodeAt(i)
            if (c < 48 || c > 57) break
            id = id * 10 + (c - 48)
            i++
        }
        lastEntry = id
        lastOk = id > 0
    }

    /**
     * True if the last WiFi connection attempt succeeded.
     */
    //% block="WiFi connected"
    //% weight=80
    export function isWifiConnected(): boolean {
        return wifiOk
    }

    /**
     * True if ThingSpeak accepted the last upload.
     */
    //% block="last upload succeeded"
    //% weight=70
    export function lastUploadOk(): boolean {
        return lastOk
    }

    /**
     * The entry number ThingSpeak gave the last upload (0 if it failed).
     */
    //% block="last entry ID"
    //% weight=60
    export function lastEntryId(): number {
        return lastEntry
    }
}

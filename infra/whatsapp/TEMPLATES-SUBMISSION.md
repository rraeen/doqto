# Doqto WhatsApp templates: BSP submission pack

Generated from `apps/api/src/integrations/whatsapp/templates.ts` (INT-09). Do not edit by hand; change the code and regenerate with
`WRITE_PACK=1 npx jest src/integrations/whatsapp/templates` in `apps/api`.

How to submit: create each template below in the BSP portal (AiSensy or Interakt) under the WhatsApp Business account, once in **English (en)** and once in **Hindi (hi)**, with the same template name. Category exactly as listed; no marketing templates. Paste the body and footer as shown (keep the line breaks and the `*bold*` markers), and enter the sample values in parameter order. Submit all of them in one batch; approval can take a day or more, and a rejected template can be edited and resubmitted.

Authentication templates: Meta supplies the wording (including the Hindi text) and only the code varies. Choose "Copy code" as the button type, turn on the security disclaimer and set the expiry to 5 minutes.

## doqto_otp

- Category: **AUTHENTICATION**
- Code keys: `otp_login`, `otp_visit`
- Sent when: Login OTP (POST /auth/otp/request) and walk-in check-in OTP (INT-08). Sent directly, never stored in the outbox.

### English (en)

Body:

```
*{{1}}* is your verification code. For your security, do not share this code.
```

Footer: `This code expires in 5 minutes.`

Samples:

1. code: 482913

Preview:

```
*482913* is your verification code. For your security, do not share this code.

This code expires in 5 minutes.
```

### Hindi (hi)

Body:

```
*{{1}}* आपका वेरिफ़िकेशन कोड है। अपनी सुरक्षा के लिए, इसे किसी के साथ शेयर न करें।
```

Footer: `यह कोड 5 मिनट में समाप्त हो जाएगा।`

Samples:

1. code: 482913

Preview:

```
*482913* आपका वेरिफ़िकेशन कोड है। अपनी सुरक्षा के लिए, इसे किसी के साथ शेयर न करें।

यह कोड 5 मिनट में समाप्त हो जाएगा।
```

## doqto_booking_confirmed

- Category: **UTILITY**
- Code keys: `booking_confirmed`
- Sent when: Payment webhook confirms a booking (BE-27); also manual bookings with a visit code.

### English (en)

Body:

```
Your appointment with Dr {{1}} at {{2}} is confirmed for {{3}} at {{4}}.

Your visit code is *{{5}}*. Tell it to the front desk when you arrive.

See live status and your place in the queue: {{6}}

Doqto
```

Footer: `Reply STOP to stop updates`

Samples:

1. doctorName: Anil Sharma
2. clinicName: Sharma Clinic, Civil Lines
3. date: Mon, 12 Oct
4. time: 10:30 AM
5. visitCode: 4821
6. liveStatusLink: https://doqto.in/a/7Kp2Qx

Preview:

```
Your appointment with Dr Anil Sharma at Sharma Clinic, Civil Lines is confirmed for Mon, 12 Oct at 10:30 AM.

Your visit code is *4821*. Tell it to the front desk when you arrive.

See live status and your place in the queue: https://doqto.in/a/7Kp2Qx

Doqto

Reply STOP to stop updates
```

### Hindi (hi)

Body:

```
आपकी अपॉइंटमेंट डॉ. {{1}} के साथ {{2}} में {{3}} को {{4}} बजे पक्की हो गई है।

आपका विज़िट कोड *{{5}}* है। क्लिनिक पहुँचकर रिसेप्शन पर यह कोड बताएँ।

लाइव स्टेटस और कतार में अपनी जगह देखें: {{6}}

Doqto
```

Footer: `अपडेट बंद करने के लिए STOP लिखें`

Samples:

1. doctorName: अनिल शर्मा
2. clinicName: शर्मा क्लिनिक, सिविल लाइन्स
3. date: सोम, 12 अक्टूबर
4. time: सुबह 10:30
5. visitCode: 4821
6. liveStatusLink: https://doqto.in/a/7Kp2Qx

Preview:

```
आपकी अपॉइंटमेंट डॉ. अनिल शर्मा के साथ शर्मा क्लिनिक, सिविल लाइन्स में सोम, 12 अक्टूबर को सुबह 10:30 बजे पक्की हो गई है।

आपका विज़िट कोड *4821* है। क्लिनिक पहुँचकर रिसेप्शन पर यह कोड बताएँ।

लाइव स्टेटस और कतार में अपनी जगह देखें: https://doqto.in/a/7Kp2Qx

Doqto

अपडेट बंद करने के लिए STOP लिखें
```

## doqto_reminder_day_before

- Category: **UTILITY**
- Code keys: `reminder_day_before`
- Sent when: Evening-before reminder job (BE-30).

### English (en)

Body:

```
Reminder: your appointment with Dr {{1}} at {{2}} is tomorrow at {{3}}.

Check whether the doctor is running late before you leave: {{4}}

Reply CANCEL if you can no longer come.
```

Footer: `Reply STOP to stop updates`

Samples:

1. doctorName: Anil Sharma
2. clinicName: Sharma Clinic, Civil Lines
3. time: 10:30 AM
4. liveStatusLink: https://doqto.in/a/7Kp2Qx

Preview:

```
Reminder: your appointment with Dr Anil Sharma at Sharma Clinic, Civil Lines is tomorrow at 10:30 AM.

Check whether the doctor is running late before you leave: https://doqto.in/a/7Kp2Qx

Reply CANCEL if you can no longer come.

Reply STOP to stop updates
```

### Hindi (hi)

Body:

```
याद दिलाना: डॉ. {{1}} के साथ {{2}} में आपकी अपॉइंटमेंट कल {{3}} बजे है।

निकलने से पहले देख लें कि डॉक्टर देर से तो नहीं चल रहे: {{4}}

अगर आप नहीं आ पाएँगे तो CANCEL लिखें।
```

Footer: `अपडेट बंद करने के लिए STOP लिखें`

Samples:

1. doctorName: अनिल शर्मा
2. clinicName: शर्मा क्लिनिक, सिविल लाइन्स
3. time: सुबह 10:30
4. liveStatusLink: https://doqto.in/a/7Kp2Qx

Preview:

```
याद दिलाना: डॉ. अनिल शर्मा के साथ शर्मा क्लिनिक, सिविल लाइन्स में आपकी अपॉइंटमेंट कल सुबह 10:30 बजे है।

निकलने से पहले देख लें कि डॉक्टर देर से तो नहीं चल रहे: https://doqto.in/a/7Kp2Qx

अगर आप नहीं आ पाएँगे तो CANCEL लिखें।

अपडेट बंद करने के लिए STOP लिखें
```

## doqto_reminder_two_hours

- Category: **UTILITY**
- Code keys: `reminder_two_hours`
- Sent when: 2-hours-before reminder job (BE-30).

### English (en)

Body:

```
Your appointment with Dr {{1}} at {{2}} is today at {{3}}.

Live status: {{4}}

Reply STATUS for an update or CANCEL to cancel.
```

Footer: `Reply STOP to stop updates`

Samples:

1. doctorName: Anil Sharma
2. clinicName: Sharma Clinic, Civil Lines
3. time: 10:30 AM
4. liveStatusLink: https://doqto.in/a/7Kp2Qx

Preview:

```
Your appointment with Dr Anil Sharma at Sharma Clinic, Civil Lines is today at 10:30 AM.

Live status: https://doqto.in/a/7Kp2Qx

Reply STATUS for an update or CANCEL to cancel.

Reply STOP to stop updates
```

### Hindi (hi)

Body:

```
डॉ. {{1}} के साथ {{2}} में आपकी अपॉइंटमेंट आज {{3}} बजे है।

लाइव स्टेटस: {{4}}

ताज़ा जानकारी के लिए STATUS लिखें, रद्द करने के लिए CANCEL लिखें।
```

Footer: `अपडेट बंद करने के लिए STOP लिखें`

Samples:

1. doctorName: अनिल शर्मा
2. clinicName: शर्मा क्लिनिक, सिविल लाइन्स
3. time: सुबह 10:30
4. liveStatusLink: https://doqto.in/a/7Kp2Qx

Preview:

```
डॉ. अनिल शर्मा के साथ शर्मा क्लिनिक, सिविल लाइन्स में आपकी अपॉइंटमेंट आज सुबह 10:30 बजे है।

लाइव स्टेटस: https://doqto.in/a/7Kp2Qx

ताज़ा जानकारी के लिए STATUS लिखें, रद्द करने के लिए CANCEL लिखें।

अपडेट बंद करने के लिए STOP लिखें
```

## doqto_doctor_running_late

- Category: **UTILITY**
- Code keys: `doctor_running_late`
- Sent when: Status alert: running late by 20+ minutes, or the delay grows by 15+ more (BE-22).

### English (en)

Body:

```
Dr {{1}} is running about {{2}} minutes late today. Your appointment is still on.

See the latest status before you leave: {{3}}

Reply CANCEL if you can no longer come.
```

Footer: `Reply STOP to stop updates`

Samples:

1. doctorName: Anil Sharma
2. delayMinutes: 30
3. liveStatusLink: https://doqto.in/a/7Kp2Qx

Preview:

```
Dr Anil Sharma is running about 30 minutes late today. Your appointment is still on.

See the latest status before you leave: https://doqto.in/a/7Kp2Qx

Reply CANCEL if you can no longer come.

Reply STOP to stop updates
```

### Hindi (hi)

Body:

```
डॉ. {{1}} आज लगभग {{2}} मिनट देर से चल रहे हैं। आपकी अपॉइंटमेंट रद्द नहीं हुई है।

निकलने से पहले ताज़ा स्टेटस देखें: {{3}}

अगर आप नहीं आ पाएँगे तो CANCEL लिखें।
```

Footer: `अपडेट बंद करने के लिए STOP लिखें`

Samples:

1. doctorName: अनिल शर्मा
2. delayMinutes: 30
3. liveStatusLink: https://doqto.in/a/7Kp2Qx

Preview:

```
डॉ. अनिल शर्मा आज लगभग 30 मिनट देर से चल रहे हैं। आपकी अपॉइंटमेंट रद्द नहीं हुई है।

निकलने से पहले ताज़ा स्टेटस देखें: https://doqto.in/a/7Kp2Qx

अगर आप नहीं आ पाएँगे तो CANCEL लिखें।

अपडेट बंद करने के लिए STOP लिखें
```

## doqto_appointment_cancelled_by_clinic

- Category: **UTILITY**
- Code keys: `appointment_cancelled_by_clinic`
- Sent when: Doctor on leave or done early with bookings left; clinic-side cancel (BE-22, BE-29). Full automatic refund.

### English (en)

Body:

```
Sorry, Dr {{1}} is not available on {{2}}, so your appointment has been cancelled.

Your booking fee of Rs {{3}} will be refunded to your original payment method, usually within 5 to 7 working days.

Book another time: {{4}}

Doqto
```

Footer: `Reply STOP to stop updates`

Samples:

1. doctorName: Anil Sharma
2. date: Mon, 12 Oct
3. feeRupees: 15
4. rebookLink: https://doqto.in/d/dr-anil-sharma-bareilly

Preview:

```
Sorry, Dr Anil Sharma is not available on Mon, 12 Oct, so your appointment has been cancelled.

Your booking fee of Rs 15 will be refunded to your original payment method, usually within 5 to 7 working days.

Book another time: https://doqto.in/d/dr-anil-sharma-bareilly

Doqto

Reply STOP to stop updates
```

### Hindi (hi)

Body:

```
माफ़ कीजिए, {{2}} को डॉ. {{1}} उपलब्ध नहीं हैं, इसलिए आपकी अपॉइंटमेंट रद्द कर दी गई है।

आपकी बुकिंग फ़ीस ₹{{3}} उसी तरीके से वापस की जाएगी जिससे आपने भुगतान किया था, आमतौर पर 5 से 7 कामकाजी दिनों में।

दूसरा समय बुक करें: {{4}}

Doqto
```

Footer: `अपडेट बंद करने के लिए STOP लिखें`

Samples:

1. doctorName: अनिल शर्मा
2. date: सोम, 12 अक्टूबर
3. feeRupees: 15
4. rebookLink: https://doqto.in/d/dr-anil-sharma-bareilly

Preview:

```
माफ़ कीजिए, सोम, 12 अक्टूबर को डॉ. अनिल शर्मा उपलब्ध नहीं हैं, इसलिए आपकी अपॉइंटमेंट रद्द कर दी गई है।

आपकी बुकिंग फ़ीस ₹15 उसी तरीके से वापस की जाएगी जिससे आपने भुगतान किया था, आमतौर पर 5 से 7 कामकाजी दिनों में।

दूसरा समय बुक करें: https://doqto.in/d/dr-anil-sharma-bareilly

Doqto

अपडेट बंद करने के लिए STOP लिखें
```

## doqto_turn_near

- Category: **UTILITY**
- Code keys: `turn_near`
- Sent when: Queue advance: the patient is 3 tokens away and has no Web Push (BE-22).

### English (en)

Body:

```
Your turn with Dr {{1}} is coming up: {{2}} patients are ahead of you.

Please reach the clinic now. Live queue: {{3}}

Doqto
```

Footer: `Reply STOP to stop updates`

Samples:

1. doctorName: Anil Sharma
2. tokensAhead: 3
3. liveStatusLink: https://doqto.in/a/7Kp2Qx

Preview:

```
Your turn with Dr Anil Sharma is coming up: 3 patients are ahead of you.

Please reach the clinic now. Live queue: https://doqto.in/a/7Kp2Qx

Doqto

Reply STOP to stop updates
```

### Hindi (hi)

Body:

```
डॉ. {{1}} के पास आपकी बारी आने वाली है: आपसे पहले {{2}} मरीज़ हैं।

कृपया अभी क्लिनिक पहुँचें। लाइव कतार: {{3}}

Doqto
```

Footer: `अपडेट बंद करने के लिए STOP लिखें`

Samples:

1. doctorName: अनिल शर्मा
2. tokensAhead: 3
3. liveStatusLink: https://doqto.in/a/7Kp2Qx

Preview:

```
डॉ. अनिल शर्मा के पास आपकी बारी आने वाली है: आपसे पहले 3 मरीज़ हैं।

कृपया अभी क्लिनिक पहुँचें। लाइव कतार: https://doqto.in/a/7Kp2Qx

Doqto

अपडेट बंद करने के लिए STOP लिखें
```

## doqto_refund_processed

- Category: **UTILITY**
- Code keys: `refund_processed`
- Sent when: Refund webhook `refund.processed` (INT-14, BE-29).

### English (en)

Body:

```
Your refund of Rs {{1}} for the appointment on {{2}} has been processed. It usually reaches your account within 5 to 7 working days.

Doqto
```

Samples:

1. feeRupees: 15
2. date: Mon, 12 Oct

Preview:

```
Your refund of Rs 15 for the appointment on Mon, 12 Oct has been processed. It usually reaches your account within 5 to 7 working days.

Doqto
```

### Hindi (hi)

Body:

```
आपकी {{2}} की अपॉइंटमेंट के लिए ₹{{1}} का रिफ़ंड प्रोसेस हो गया है। यह आमतौर पर 5 से 7 कामकाजी दिनों में आपके खाते में आ जाता है।

Doqto
```

Samples:

1. feeRupees: 15
2. date: सोम, 12 अक्टूबर

Preview:

```
आपकी सोम, 12 अक्टूबर की अपॉइंटमेंट के लिए ₹15 का रिफ़ंड प्रोसेस हो गया है। यह आमतौर पर 5 से 7 कामकाजी दिनों में आपके खाते में आ जाता है।

Doqto
```

## doqto_late_payment_refunded

- Category: **UTILITY**
- Code keys: `late_payment_refunded`
- Sent when: Payment arrived after the 10-minute hold expired and the slot was taken (BE-28).

### English (en)

Body:

```
Your payment reached us after your slot hold ended and the slot was booked by someone else, so we have refunded Rs {{1}}.

See available slots with Dr {{2}}: {{3}}

Doqto
```

Samples:

1. feeRupees: 15
2. doctorName: Anil Sharma
3. slotsLink: https://doqto.in/d/dr-anil-sharma-bareilly

Preview:

```
Your payment reached us after your slot hold ended and the slot was booked by someone else, so we have refunded Rs 15.

See available slots with Dr Anil Sharma: https://doqto.in/d/dr-anil-sharma-bareilly

Doqto
```

### Hindi (hi)

Body:

```
आपका भुगतान स्लॉट होल्ड खत्म होने के बाद मिला और वह स्लॉट किसी और ने बुक कर लिया, इसलिए हमने ₹{{1}} वापस कर दिए हैं।

डॉ. {{2}} के खाली स्लॉट देखें: {{3}}

Doqto
```

Samples:

1. feeRupees: 15
2. doctorName: अनिल शर्मा
3. slotsLink: https://doqto.in/d/dr-anil-sharma-bareilly

Preview:

```
आपका भुगतान स्लॉट होल्ड खत्म होने के बाद मिला और वह स्लॉट किसी और ने बुक कर लिया, इसलिए हमने ₹15 वापस कर दिए हैं।

डॉ. अनिल शर्मा के खाली स्लॉट देखें: https://doqto.in/d/dr-anil-sharma-bareilly

Doqto
```

## doqto_review_open

- Category: **UTILITY**
- Code keys: `review_open`
- Sent when: Review unlocks 24 hours after a verified visit (BE-38).

### English (en)

Body:

```
How was your visit to Dr {{1}}? You can now review it. Only patients with a verified visit can.

Write your review: {{2}}

Doqto
```

Footer: `Reply STOP to stop updates`

Samples:

1. doctorName: Anil Sharma
2. reviewLink: https://doqto.in/r/7Kp2Qx

Preview:

```
How was your visit to Dr Anil Sharma? You can now review it. Only patients with a verified visit can.

Write your review: https://doqto.in/r/7Kp2Qx

Doqto

Reply STOP to stop updates
```

### Hindi (hi)

Body:

```
डॉ. {{1}} के पास आपका अनुभव कैसा रहा? अब आप रिव्यू लिख सकते हैं। केवल वेरिफ़ाइड विज़िट वाले मरीज़ ही रिव्यू लिख सकते हैं।

रिव्यू लिखें: {{2}}

Doqto
```

Footer: `अपडेट बंद करने के लिए STOP लिखें`

Samples:

1. doctorName: अनिल शर्मा
2. reviewLink: https://doqto.in/r/7Kp2Qx

Preview:

```
डॉ. अनिल शर्मा के पास आपका अनुभव कैसा रहा? अब आप रिव्यू लिख सकते हैं। केवल वेरिफ़ाइड विज़िट वाले मरीज़ ही रिव्यू लिख सकते हैं।

रिव्यू लिखें: https://doqto.in/r/7Kp2Qx

Doqto

अपडेट बंद करने के लिए STOP लिखें
```

## doqto_review_reminder

- Category: **UTILITY**
- Code keys: `review_reminder`
- Sent when: Day 5 after unlock, sent once, never again (BE-38).

### English (en)

Body:

```
You can review your visit to Dr {{1}} until {{2}}.

Write your review: {{3}}

Doqto
```

Footer: `Reply STOP to stop updates`

Samples:

1. doctorName: Anil Sharma
2. lastDate: 11 Nov
3. reviewLink: https://doqto.in/r/7Kp2Qx

Preview:

```
You can review your visit to Dr Anil Sharma until 11 Nov.

Write your review: https://doqto.in/r/7Kp2Qx

Doqto

Reply STOP to stop updates
```

### Hindi (hi)

Body:

```
आप डॉ. {{1}} के पास अपनी विज़िट का रिव्यू {{2}} तक लिख सकते हैं।

रिव्यू लिखें: {{3}}

Doqto
```

Footer: `अपडेट बंद करने के लिए STOP लिखें`

Samples:

1. doctorName: अनिल शर्मा
2. lastDate: 11 नवंबर
3. reviewLink: https://doqto.in/r/7Kp2Qx

Preview:

```
आप डॉ. अनिल शर्मा के पास अपनी विज़िट का रिव्यू 11 नवंबर तक लिख सकते हैं।

रिव्यू लिखें: https://doqto.in/r/7Kp2Qx

Doqto

अपडेट बंद करने के लिए STOP लिखें
```

## doqto_review_replied

- Category: **UTILITY**
- Code keys: `review_replied`
- Sent when: Doctor posts a reply to the patient review (BE-36).

### English (en)

Body:

```
Dr {{1}} has replied to your review.

Read the reply: {{2}}

Doqto
```

Footer: `Reply STOP to stop updates`

Samples:

1. doctorName: Anil Sharma
2. reviewLink: https://doqto.in/r/7Kp2Qx

Preview:

```
Dr Anil Sharma has replied to your review.

Read the reply: https://doqto.in/r/7Kp2Qx

Doqto

Reply STOP to stop updates
```

### Hindi (hi)

Body:

```
डॉ. {{1}} ने आपके रिव्यू का जवाब दिया है।

जवाब पढ़ें: {{2}}

Doqto
```

Footer: `अपडेट बंद करने के लिए STOP लिखें`

Samples:

1. doctorName: अनिल शर्मा
2. reviewLink: https://doqto.in/r/7Kp2Qx

Preview:

```
डॉ. अनिल शर्मा ने आपके रिव्यू का जवाब दिया है।

जवाब पढ़ें: https://doqto.in/r/7Kp2Qx

Doqto

अपडेट बंद करने के लिए STOP लिखें
```

## Keywords the webhook handles (INT-10)

Patients can reply **STATUS** (today's doctor status), **CANCEL** (starts a cancel confirmation) and **STOP** (turns off non-OTP WhatsApp updates; sets `whatsappOptIn: false`). Replies within 24 hours of the patient writing in are session messages and need no template.

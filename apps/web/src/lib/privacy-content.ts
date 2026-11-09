import type { Locale } from '@/i18n/config';

export interface PolicyContent {
  title: string;
  updated: string;
  intro: string;
  sections: Array<{ heading: string; body: string[] }>;
  contactHeading: string;
  contactBody: string;
  contactLink: string;
}

/**
 * Plain-language privacy policy that describes what the app does today. It is a draft for legal
 * review before launch (DPDP Act 2023); keep it in step with the product when data use changes.
 */
export const PRIVACY: Record<Locale, PolicyContent> = {
  en: {
    title: 'Privacy policy',
    updated: 'Last updated: 20 October 2026',
    intro:
      'Doqto helps you find a verified doctor, book a visit and see the live status of a clinic. This page explains what we collect, why, and the choices you have. We keep it short and in plain words.',
    sections: [
      {
        heading: 'What we collect',
        body: [
          'Your mobile number, which you use to sign in with a one-time code.',
          'Your name and preferred language, if you add them.',
          'Whether you want updates on WhatsApp.',
          'Your bookings: the doctor, clinic, date and time, and the reason for the visit if you give one.',
          'Basic technical data such as a sign-in session on your device, so you stay signed in.',
        ],
      },
      {
        heading: 'What we do not collect',
        body: [
          'In this version Doqto does not store medical records, reports, prescriptions or chat messages with doctors. Screens that show these are examples only.',
          'We do not collect your exact location. If you choose “near me”, your device location is used to search and is not saved.',
        ],
      },
      {
        heading: 'Why we use your data',
        body: [
          'To sign you in and keep your account safe.',
          'To book, change and remind you about visits.',
          'To show you doctors and clinics in your city.',
          'To fix problems and improve the app.',
        ],
      },
      {
        heading: 'Who can see it',
        body: [
          'The doctor or clinic you book with sees your name, mobile number and booking details so they can treat you.',
          'Services that send our codes and reminders (SMS and WhatsApp) receive your mobile number and message.',
          'We do not sell your data and we do not use it for third-party advertising.',
          'We may share data if the law requires it.',
        ],
      },
      {
        heading: 'How long we keep it',
        body: [
          'We keep your account and bookings while your account is active. When you ask us to delete your account, we delete or anonymise your data, except what we must keep by law.',
        ],
      },
      {
        heading: 'Your choices',
        body: [
          'See and correct your name and language in Profile.',
          'Turn WhatsApp updates on or off at any time.',
          'Ask us to delete your account and data.',
          'Withdraw your consent whenever you like. Some features will stop working without the data they need.',
        ],
      },
      {
        heading: 'Children',
        body: [
          'If you are under 18, please use Doqto with a parent or guardian, who should book on your behalf.',
        ],
      },
      {
        heading: 'Security',
        body: [
          'We protect data in transit and limit who can access it. No system is perfectly secure, so please keep your phone and codes private.',
        ],
      },
      {
        heading: 'Changes to this policy',
        body: ['If we change how we use your data, we will update this page and the date above.'],
      },
    ],
    contactHeading: 'Questions or requests',
    contactBody:
      'To ask about your data, correct it or delete it, write to us through Help & support in the app.',
    contactLink: 'Open Help & support',
  },
  hi: {
    title: 'गोपनीयता नीति',
    updated: 'आख़िरी अपडेट: 20 अक्टूबर 2026',
    intro:
      'Doqto आपको सत्यापित डॉक्टर खोजने, विज़िट बुक करने और क्लिनिक का लाइव स्टेटस देखने में मदद करता है। यह पेज बताता है कि हम क्या जानकारी लेते हैं, क्यों लेते हैं और आपके पास क्या विकल्प हैं।',
    sections: [
      {
        heading: 'हम क्या जानकारी लेते हैं',
        body: [
          'आपका मोबाइल नंबर, जिससे आप एक बार के कोड से साइन इन करते हैं।',
          'आपका नाम और पसंदीदा भाषा, अगर आप जोड़ते हैं।',
          'क्या आप WhatsApp पर अपडेट चाहते हैं।',
          'आपकी बुकिंग: डॉक्टर, क्लिनिक, तारीख और समय, और विज़िट का कारण अगर आप बताएँ।',
          'बुनियादी तकनीकी जानकारी, जैसे आपके डिवाइस पर साइन-इन सेशन, ताकि आप साइन इन बने रहें।',
        ],
      },
      {
        heading: 'हम क्या जानकारी नहीं लेते',
        body: [
          'इस संस्करण में Doqto मेडिकल रिकॉर्ड, रिपोर्ट, पर्चे या डॉक्टर के साथ चैट के संदेश सहेजता नहीं है। इन्हें दिखाने वाली स्क्रीन केवल उदाहरण हैं।',
          'हम आपकी सटीक लोकेशन नहीं लेते। अगर आप “मेरे पास” चुनते हैं, तो खोज के लिए डिवाइस की लोकेशन इस्तेमाल होती है और सहेजी नहीं जाती।',
        ],
      },
      {
        heading: 'हम आपकी जानकारी क्यों इस्तेमाल करते हैं',
        body: [
          'आपको साइन इन कराने और आपका अकाउंट सुरक्षित रखने के लिए।',
          'विज़िट बुक करने, बदलने और याद दिलाने के लिए।',
          'आपके शहर के डॉक्टर और क्लिनिक दिखाने के लिए।',
          'समस्याएँ ठीक करने और ऐप बेहतर बनाने के लिए।',
        ],
      },
      {
        heading: 'इसे कौन देख सकता है',
        body: [
          'जिस डॉक्टर या क्लिनिक में आप बुक करते हैं, वह आपका नाम, मोबाइल नंबर और बुकिंग की जानकारी देखता है, ताकि वे आपका इलाज कर सकें।',
          'हमारे कोड और रिमाइंडर भेजने वाली सेवाएँ (SMS और WhatsApp) आपका मोबाइल नंबर और संदेश पाती हैं।',
          'हम आपकी जानकारी बेचते नहीं हैं और तीसरे पक्ष के विज्ञापनों के लिए इस्तेमाल नहीं करते।',
          'कानून माँगे तो हम जानकारी साझा कर सकते हैं।',
        ],
      },
      {
        heading: 'हम इसे कितने समय रखते हैं',
        body: [
          'जब तक आपका अकाउंट चालू है, हम आपका अकाउंट और बुकिंग रखते हैं। जब आप अकाउंट हटाने को कहते हैं, तो हम आपकी जानकारी हटा देते हैं या गुमनाम कर देते हैं, सिवाय उसके जो कानून के अनुसार रखना ज़रूरी है।',
        ],
      },
      {
        heading: 'आपके विकल्प',
        body: [
          'प्रोफ़ाइल में अपना नाम और भाषा देखें और ठीक करें।',
          'WhatsApp अपडेट कभी भी चालू या बंद करें।',
          'हमसे अपना अकाउंट और जानकारी हटाने को कहें।',
          'जब चाहें अपनी सहमति वापस लें। जिन सुविधाओं को वह जानकारी चाहिए, वे बंद हो जाएँगी।',
        ],
      },
      {
        heading: 'बच्चे',
        body: [
          'अगर आपकी उम्र 18 साल से कम है, तो कृपया माता-पिता या अभिभावक के साथ Doqto इस्तेमाल करें, जो आपकी ओर से बुकिंग करें।',
        ],
      },
      {
        heading: 'सुरक्षा',
        body: [
          'हम जानकारी को भेजते समय सुरक्षित रखते हैं और उस तक पहुँच सीमित रखते हैं। कोई भी सिस्टम पूरी तरह सुरक्षित नहीं होता, इसलिए अपना फ़ोन और कोड गोपनीय रखें।',
        ],
      },
      {
        heading: 'इस नीति में बदलाव',
        body: [
          'अगर हम आपकी जानकारी के इस्तेमाल का तरीका बदलते हैं, तो इस पेज और ऊपर की तारीख को अपडेट करेंगे।',
        ],
      },
    ],
    contactHeading: 'सवाल या अनुरोध',
    contactBody:
      'अपनी जानकारी के बारे में पूछने, उसे ठीक कराने या हटवाने के लिए ऐप में मदद और सहायता के ज़रिए हमें लिखें।',
    contactLink: 'मदद और सहायता खोलें',
  },
};

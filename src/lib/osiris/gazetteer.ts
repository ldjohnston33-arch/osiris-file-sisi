/**
 * Gazetteer for keyword geocoding and entity extraction.
 *
 * Classification runs on ingest with plain keyword rules (no AI call per item),
 * so every place, country and leader the classifier can recognise lives here.
 * Leader names map to their country, not to a person record: the tool tracks
 * state-to-state engagement, and office-holders change.
 */

export interface CountryEntry {
  code: string;
  name: string;
  /** Lower-case match terms: name variants and demonyms. */
  terms: string[];
  capital: { name: string; lat: number; lng: number };
  region: 'gulf' | 'levant' | 'maghreb' | 'africa' | 'europe' | 'asia' | 'americas' | 'multilateral' | 'egypt';
}

export const COUNTRIES: CountryEntry[] = [
  { code: 'EG', name: 'Egypt', terms: ['egypt', 'egyptian'], capital: { name: 'Cairo', lat: 30.0444, lng: 31.2357 }, region: 'egypt' },
  // Gulf
  { code: 'SA', name: 'Saudi Arabia', terms: ['saudi', 'saudi arabia', 'kingdom of saudi arabia', 'riyadh'], capital: { name: 'Riyadh', lat: 24.7136, lng: 46.6753 }, region: 'gulf' },
  { code: 'AE', name: 'United Arab Emirates', terms: ['uae', 'u.a.e', 'emirati', 'emirates', 'united arab emirates', 'abu dhabi'], capital: { name: 'Abu Dhabi', lat: 24.4539, lng: 54.3773 }, region: 'gulf' },
  { code: 'QA', name: 'Qatar', terms: ['qatar', 'qatari', 'doha'], capital: { name: 'Doha', lat: 25.2854, lng: 51.531 }, region: 'gulf' },
  { code: 'KW', name: 'Kuwait', terms: ['kuwait', 'kuwaiti'], capital: { name: 'Kuwait City', lat: 29.3759, lng: 47.9774 }, region: 'gulf' },
  { code: 'BH', name: 'Bahrain', terms: ['bahrain', 'bahraini', 'manama'], capital: { name: 'Manama', lat: 26.2285, lng: 50.586 }, region: 'gulf' },
  { code: 'OM', name: 'Oman', terms: ['oman', 'omani', 'muscat'], capital: { name: 'Muscat', lat: 23.588, lng: 58.3829 }, region: 'gulf' },
  { code: 'IR', name: 'Iran', terms: ['iran', 'iranian', 'tehran'], capital: { name: 'Tehran', lat: 35.6892, lng: 51.389 }, region: 'gulf' },
  { code: 'IQ', name: 'Iraq', terms: ['iraq', 'iraqi', 'baghdad'], capital: { name: 'Baghdad', lat: 33.3152, lng: 44.3661 }, region: 'gulf' },
  { code: 'YE', name: 'Yemen', terms: ['yemen', 'yemeni', 'houthi', 'houthis', 'sanaa', "sana'a"], capital: { name: "Sana'a", lat: 15.3694, lng: 44.191 }, region: 'gulf' },
  // Levant
  { code: 'PS', name: 'Palestine', terms: ['palestine', 'palestinian', 'palestinians', 'gaza', 'west bank', 'ramallah'], capital: { name: 'Ramallah', lat: 31.9038, lng: 35.2034 }, region: 'levant' },
  { code: 'IL', name: 'Israel', terms: ['israel', 'israeli'], capital: { name: 'Jerusalem', lat: 31.7683, lng: 35.2137 }, region: 'levant' },
  { code: 'JO', name: 'Jordan', terms: ['jordan', 'jordanian', 'amman'], capital: { name: 'Amman', lat: 31.9454, lng: 35.9284 }, region: 'levant' },
  { code: 'LB', name: 'Lebanon', terms: ['lebanon', 'lebanese', 'beirut'], capital: { name: 'Beirut', lat: 33.8938, lng: 35.5018 }, region: 'levant' },
  { code: 'SY', name: 'Syria', terms: ['syria', 'syrian', 'damascus'], capital: { name: 'Damascus', lat: 33.5138, lng: 36.2765 }, region: 'levant' },
  { code: 'TR', name: 'Turkey', terms: ['turkey', 'türkiye', 'turkiye', 'turkish', 'ankara'], capital: { name: 'Ankara', lat: 39.9334, lng: 32.8597 }, region: 'levant' },
  { code: 'CY', name: 'Cyprus', terms: ['cyprus', 'cypriot', 'nicosia'], capital: { name: 'Nicosia', lat: 35.1856, lng: 33.3823 }, region: 'europe' },
  { code: 'GR', name: 'Greece', terms: ['greece', 'greek', 'athens'], capital: { name: 'Athens', lat: 37.9838, lng: 23.7275 }, region: 'europe' },
  // Maghreb / Africa
  { code: 'LY', name: 'Libya', terms: ['libya', 'libyan', 'tripoli', 'benghazi'], capital: { name: 'Tripoli', lat: 32.8872, lng: 13.1913 }, region: 'maghreb' },
  { code: 'SD', name: 'Sudan', terms: ['sudan', 'sudanese', 'khartoum', 'port sudan'], capital: { name: 'Khartoum', lat: 15.5007, lng: 32.5599 }, region: 'africa' },
  { code: 'SS', name: 'South Sudan', terms: ['south sudan', 'juba'], capital: { name: 'Juba', lat: 4.8594, lng: 31.5713 }, region: 'africa' },
  { code: 'ET', name: 'Ethiopia', terms: ['ethiopia', 'ethiopian', 'addis ababa'], capital: { name: 'Addis Ababa', lat: 9.03, lng: 38.74 }, region: 'africa' },
  { code: 'ER', name: 'Eritrea', terms: ['eritrea', 'eritrean', 'asmara'], capital: { name: 'Asmara', lat: 15.3229, lng: 38.9251 }, region: 'africa' },
  { code: 'SO', name: 'Somalia', terms: ['somalia', 'somali', 'mogadishu'], capital: { name: 'Mogadishu', lat: 2.0469, lng: 45.3182 }, region: 'africa' },
  { code: 'DJ', name: 'Djibouti', terms: ['djibouti', 'djiboutian'], capital: { name: 'Djibouti', lat: 11.5886, lng: 43.145 }, region: 'africa' },
  { code: 'KE', name: 'Kenya', terms: ['kenya', 'kenyan', 'nairobi'], capital: { name: 'Nairobi', lat: -1.2921, lng: 36.8219 }, region: 'africa' },
  { code: 'UG', name: 'Uganda', terms: ['uganda', 'ugandan', 'kampala'], capital: { name: 'Kampala', lat: 0.3476, lng: 32.5825 }, region: 'africa' },
  { code: 'TZ', name: 'Tanzania', terms: ['tanzania', 'tanzanian', 'dodoma'], capital: { name: 'Dodoma', lat: -6.163, lng: 35.7516 }, region: 'africa' },
  { code: 'RW', name: 'Rwanda', terms: ['rwanda', 'rwandan', 'kigali'], capital: { name: 'Kigali', lat: -1.9441, lng: 30.0619 }, region: 'africa' },
  { code: 'CD', name: 'DR Congo', terms: ['dr congo', 'democratic republic of the congo', 'drc', 'congolese', 'kinshasa'], capital: { name: 'Kinshasa', lat: -4.4419, lng: 15.2663 }, region: 'africa' },
  { code: 'TD', name: 'Chad', terms: ['chad', 'chadian', "n'djamena"], capital: { name: "N'Djamena", lat: 12.1348, lng: 15.0557 }, region: 'africa' },
  { code: 'NG', name: 'Nigeria', terms: ['nigeria', 'nigerian', 'abuja'], capital: { name: 'Abuja', lat: 9.0765, lng: 7.3986 }, region: 'africa' },
  { code: 'ZA', name: 'South Africa', terms: ['south africa', 'south african', 'pretoria', 'johannesburg'], capital: { name: 'Pretoria', lat: -25.7479, lng: 28.2293 }, region: 'africa' },
  { code: 'DZ', name: 'Algeria', terms: ['algeria', 'algerian', 'algiers'], capital: { name: 'Algiers', lat: 36.7538, lng: 3.0588 }, region: 'maghreb' },
  { code: 'TN', name: 'Tunisia', terms: ['tunisia', 'tunisian', 'tunis'], capital: { name: 'Tunis', lat: 36.8065, lng: 10.1815 }, region: 'maghreb' },
  { code: 'MA', name: 'Morocco', terms: ['morocco', 'moroccan', 'rabat'], capital: { name: 'Rabat', lat: 34.0209, lng: -6.8416 }, region: 'maghreb' },
  { code: 'MR', name: 'Mauritania', terms: ['mauritania', 'mauritanian', 'nouakchott'], capital: { name: 'Nouakchott', lat: 18.0735, lng: -15.9582 }, region: 'maghreb' },
  // Europe
  { code: 'FR', name: 'France', terms: ['france', 'french', 'paris', 'élysée', 'elysee'], capital: { name: 'Paris', lat: 48.8566, lng: 2.3522 }, region: 'europe' },
  { code: 'DE', name: 'Germany', terms: ['germany', 'german', 'berlin'], capital: { name: 'Berlin', lat: 52.52, lng: 13.405 }, region: 'europe' },
  { code: 'IT', name: 'Italy', terms: ['italy', 'italian', 'rome'], capital: { name: 'Rome', lat: 41.9028, lng: 12.4964 }, region: 'europe' },
  { code: 'ES', name: 'Spain', terms: ['spain', 'spanish', 'madrid'], capital: { name: 'Madrid', lat: 40.4168, lng: -3.7038 }, region: 'europe' },
  { code: 'GB', name: 'United Kingdom', terms: ['united kingdom', 'britain', 'british', 'uk', 'london'], capital: { name: 'London', lat: 51.5074, lng: -0.1278 }, region: 'europe' },
  { code: 'RU', name: 'Russia', terms: ['russia', 'russian', 'moscow', 'kremlin'], capital: { name: 'Moscow', lat: 55.7558, lng: 37.6173 }, region: 'europe' },
  { code: 'UA', name: 'Ukraine', terms: ['ukraine', 'ukrainian', 'kyiv'], capital: { name: 'Kyiv', lat: 50.4501, lng: 30.5234 }, region: 'europe' },
  { code: 'RS', name: 'Serbia', terms: ['serbia', 'serbian', 'belgrade'], capital: { name: 'Belgrade', lat: 44.7866, lng: 20.4489 }, region: 'europe' },
  { code: 'HU', name: 'Hungary', terms: ['hungary', 'hungarian', 'budapest'], capital: { name: 'Budapest', lat: 47.4979, lng: 19.0402 }, region: 'europe' },
  { code: 'AZ', name: 'Azerbaijan', terms: ['azerbaijan', 'azerbaijani', 'baku'], capital: { name: 'Baku', lat: 40.4093, lng: 49.8671 }, region: 'asia' },
  // Asia
  { code: 'CN', name: 'China', terms: ['china', 'chinese', 'beijing'], capital: { name: 'Beijing', lat: 39.9042, lng: 116.4074 }, region: 'asia' },
  { code: 'IN', name: 'India', terms: ['india', 'indian', 'new delhi'], capital: { name: 'New Delhi', lat: 28.6139, lng: 77.209 }, region: 'asia' },
  { code: 'JP', name: 'Japan', terms: ['japan', 'japanese', 'tokyo'], capital: { name: 'Tokyo', lat: 35.6762, lng: 139.6503 }, region: 'asia' },
  { code: 'KR', name: 'South Korea', terms: ['south korea', 'korean', 'republic of korea', 'seoul'], capital: { name: 'Seoul', lat: 37.5665, lng: 126.978 }, region: 'asia' },
  { code: 'PK', name: 'Pakistan', terms: ['pakistan', 'pakistani', 'islamabad'], capital: { name: 'Islamabad', lat: 33.6844, lng: 73.0479 }, region: 'asia' },
  { code: 'ID', name: 'Indonesia', terms: ['indonesia', 'indonesian', 'jakarta'], capital: { name: 'Jakarta', lat: -6.2088, lng: 106.8456 }, region: 'asia' },
  { code: 'MY', name: 'Malaysia', terms: ['malaysia', 'malaysian', 'kuala lumpur'], capital: { name: 'Kuala Lumpur', lat: 3.139, lng: 101.6869 }, region: 'asia' },
  { code: 'SG', name: 'Singapore', terms: ['singapore', 'singaporean'], capital: { name: 'Singapore', lat: 1.3521, lng: 103.8198 }, region: 'asia' },
  { code: 'VN', name: 'Vietnam', terms: ['vietnam', 'vietnamese', 'hanoi'], capital: { name: 'Hanoi', lat: 21.0278, lng: 105.8342 }, region: 'asia' },
  { code: 'KZ', name: 'Kazakhstan', terms: ['kazakhstan', 'kazakh', 'astana'], capital: { name: 'Astana', lat: 51.1694, lng: 71.4491 }, region: 'asia' },
  { code: 'UZ', name: 'Uzbekistan', terms: ['uzbekistan', 'uzbek', 'tashkent'], capital: { name: 'Tashkent', lat: 41.2995, lng: 69.2401 }, region: 'asia' },
  // Americas
  { code: 'US', name: 'United States', terms: ['united states', 'u.s.', 'us', 'usa', 'american', 'washington', 'white house'], capital: { name: 'Washington, D.C.', lat: 38.9072, lng: -77.0369 }, region: 'americas' },
  { code: 'BR', name: 'Brazil', terms: ['brazil', 'brazilian', 'brasília', 'brasilia'], capital: { name: 'Brasília', lat: -15.7975, lng: -47.8919 }, region: 'americas' },
  { code: 'CA', name: 'Canada', terms: ['canada', 'canadian', 'ottawa'], capital: { name: 'Ottawa', lat: 45.4215, lng: -75.6972 }, region: 'americas' },
  // Multilateral
  { code: 'EU', name: 'European Union', terms: ['european union', 'eu', 'european commission', 'brussels'], capital: { name: 'Brussels', lat: 50.8503, lng: 4.3517 }, region: 'multilateral' },
  { code: 'UN', name: 'United Nations', terms: ['united nations', 'un secretary-general', 'unsc', 'security council'], capital: { name: 'New York', lat: 40.7489, lng: -73.968 }, region: 'multilateral' },
  { code: 'AU', name: 'African Union', terms: ['african union'], capital: { name: 'Addis Ababa', lat: 9.03, lng: 38.74 }, region: 'multilateral' },
  { code: 'AL', name: 'Arab League', terms: ['arab league', 'league of arab states'], capital: { name: 'Cairo', lat: 30.0444, lng: 31.2357 }, region: 'multilateral' },
  { code: 'IMF', name: 'IMF', terms: ['imf', 'international monetary fund'], capital: { name: 'Washington, D.C.', lat: 38.8987, lng: -77.0425 }, region: 'multilateral' },
];

/** Leader / official names that identify a partner country. */
export const LEADERS: { terms: string[]; code: string; label: string }[] = [
  { terms: ['xi jinping'], code: 'CN', label: 'Xi Jinping' },
  { terms: ['narendra modi', 'modi'], code: 'IN', label: 'Narendra Modi' },
  { terms: ['mohammed bin salman', 'mohammad bin salman', 'crown prince mohammed', 'king salman'], code: 'SA', label: 'Saudi leadership' },
  { terms: ['mohamed bin zayed', 'mohammed bin zayed', 'bin zayed'], code: 'AE', label: 'Mohamed bin Zayed' },
  { terms: ['tamim bin hamad', 'emir tamim'], code: 'QA', label: 'Tamim bin Hamad' },
  { terms: ['erdogan', 'erdoğan'], code: 'TR', label: 'Recep Tayyip Erdoğan' },
  { terms: ['macron'], code: 'FR', label: 'Emmanuel Macron' },
  { terms: ['trump'], code: 'US', label: 'Donald Trump' },
  { terms: ['rubio', 'witkoff'], code: 'US', label: 'US officials' },
  { terms: ['putin', 'lavrov'], code: 'RU', label: 'Russian leadership' },
  { terms: ['mahmoud abbas', 'abu mazen'], code: 'PS', label: 'Mahmoud Abbas' },
  { terms: ['netanyahu'], code: 'IL', label: 'Benjamin Netanyahu' },
  { terms: ['burhan', 'al-burhan'], code: 'SD', label: 'Abdel Fattah al-Burhan' },
  { terms: ['haftar'], code: 'LY', label: 'Khalifa Haftar' },
  { terms: ['dbeibah', 'dbeiba', 'menfi'], code: 'LY', label: 'Libyan leadership' },
  { terms: ['abiy ahmed', 'abiy'], code: 'ET', label: 'Abiy Ahmed' },
  { terms: ['tebboune'], code: 'DZ', label: 'Abdelmadjid Tebboune' },
  { terms: ['king abdullah'], code: 'JO', label: 'King Abdullah II' },
  { terms: ['meloni'], code: 'IT', label: 'Giorgia Meloni' },
  { terms: ['von der leyen', 'kaja kallas', 'antónio costa', 'antonio costa'], code: 'EU', label: 'EU leadership' },
  { terms: ['guterres'], code: 'UN', label: 'António Guterres' },
  { terms: ['hassan sheikh mohamud'], code: 'SO', label: 'Hassan Sheikh Mohamud' },
  { terms: ['pezeshkian', 'araghchi'], code: 'IR', label: 'Iranian leadership' },
  { terms: ['joseph aoun', 'nawaf salam'], code: 'LB', label: 'Lebanese leadership' },
  { terms: ['al-sharaa', 'ahmed al-sharaa'], code: 'SY', label: 'Ahmed al-Sharaa' },
  { terms: ['ramaphosa'], code: 'ZA', label: 'Cyril Ramaphosa' },
  { terms: ['lula'], code: 'BR', label: 'Luiz Inácio Lula da Silva' },
  { terms: ['starmer'], code: 'GB', label: 'Keir Starmer' },
  { terms: ['merz', 'steinmeier'], code: 'DE', label: 'German leadership' },
  { terms: ['mitsotakis'], code: 'GR', label: 'Kyriakos Mitsotakis' },
  { terms: ['christodoulides'], code: 'CY', label: 'Nikos Christodoulides' },
  { terms: ['aliyev'], code: 'AZ', label: 'Ilham Aliyev' },
  { terms: ['tokayev'], code: 'KZ', label: 'Kassym-Jomart Tokayev' },
  { terms: ['mirziyoyev'], code: 'UZ', label: 'Shavkat Mirziyoyev' },
  { terms: ['prabowo'], code: 'ID', label: 'Prabowo Subianto' },
  { terms: ['anwar ibrahim'], code: 'MY', label: 'Anwar Ibrahim' },
  { terms: ['shehbaz sharif'], code: 'PK', label: 'Shehbaz Sharif' },
  { terms: ['ruto'], code: 'KE', label: 'William Ruto' },
  { terms: ['museveni'], code: 'UG', label: 'Yoweri Museveni' },
  { terms: ['kagame'], code: 'RW', label: 'Paul Kagame' },
  { terms: ['georgieva', 'imf managing director'], code: 'IMF', label: 'IMF leadership' },
  { terms: ['aboul gheit', 'aboul-gheit'], code: 'AL', label: 'Arab League Secretary-General' },
];

/** Cities and sites, including Egyptian venues Sisi uses for summits. */
export const PLACES: { terms: string[]; name: string; lat: number; lng: number; country: string }[] = [
  // Egypt
  { terms: ['new administrative capital', 'administrative capital'], name: 'New Administrative Capital', lat: 30.0196, lng: 31.7625, country: 'EG' },
  { terms: ['ittihadiya', 'heliopolis palace', 'al-ittihadiya'], name: 'Ittihadiya Palace, Cairo', lat: 30.0921, lng: 31.3217, country: 'EG' },
  { terms: ['el alamein', 'el-alamein', 'new alamein', 'alamein'], name: 'El Alamein', lat: 30.8333, lng: 28.95, country: 'EG' },
  { terms: ['sharm el-sheikh', 'sharm el sheikh', 'sharm'], name: 'Sharm el-Sheikh', lat: 27.9158, lng: 34.33, country: 'EG' },
  { terms: ['alexandria'], name: 'Alexandria', lat: 31.2001, lng: 29.9187, country: 'EG' },
  { terms: ['ismailia'], name: 'Ismailia', lat: 30.5965, lng: 32.2715, country: 'EG' },
  { terms: ['port said'], name: 'Port Said', lat: 31.2653, lng: 32.3019, country: 'EG' },
  { terms: ['suez city', 'ain sokhna', 'sokhna'], name: 'Ain Sokhna', lat: 29.6, lng: 32.35, country: 'EG' },
  { terms: ['damietta'], name: 'Damietta', lat: 31.4165, lng: 31.8133, country: 'EG' },
  { terms: ['al-arish', 'el-arish', 'arish'], name: 'El-Arish', lat: 31.1316, lng: 33.7984, country: 'EG' },
  { terms: ['rafah crossing', 'rafah'], name: 'Rafah crossing', lat: 31.2472, lng: 34.2596, country: 'EG' },
  { terms: ['aswan'], name: 'Aswan', lat: 24.0889, lng: 32.8998, country: 'EG' },
  { terms: ['luxor'], name: 'Luxor', lat: 25.6872, lng: 32.6396, country: 'EG' },
  { terms: ['hurghada'], name: 'Hurghada', lat: 27.2579, lng: 33.8116, country: 'EG' },
  { terms: ['salloum', 'sallum'], name: 'Salloum', lat: 31.5525, lng: 25.1596, country: 'EG' },
  { terms: ['sidi barrani'], name: 'Sidi Barrani', lat: 31.6108, lng: 25.926, country: 'EG' },
  { terms: ['ras el-hekma', 'ras el hekma', 'ras al-hekma'], name: 'Ras El-Hekma', lat: 31.2044, lng: 27.8615, country: 'EG' },
  { terms: ['cairo'], name: 'Cairo', lat: 30.0444, lng: 31.2357, country: 'EG' },
  // Theaters
  { terms: ['khan younis', 'khan yunis'], name: 'Khan Younis', lat: 31.3462, lng: 34.3063, country: 'PS' },
  { terms: ['gaza city'], name: 'Gaza City', lat: 31.5017, lng: 34.4668, country: 'PS' },
  { terms: ['kerem shalom'], name: 'Kerem Shalom crossing', lat: 31.2266, lng: 34.2839, country: 'IL' },
  { terms: ['philadelphi'], name: 'Philadelphi corridor', lat: 31.275, lng: 34.25, country: 'PS' },
  { terms: ['sirte'], name: 'Sirte', lat: 31.2089, lng: 16.5887, country: 'LY' },
  { terms: ['jufra', 'al-jufra'], name: 'Al-Jufra', lat: 29.1268, lng: 15.9477, country: 'LY' },
  { terms: ['benghazi'], name: 'Benghazi', lat: 32.1167, lng: 20.0667, country: 'LY' },
  { terms: ['misrata'], name: 'Misrata', lat: 32.3754, lng: 15.0925, country: 'LY' },
  { terms: ['tripoli'], name: 'Tripoli', lat: 32.8872, lng: 13.1913, country: 'LY' },
  { terms: ['el fasher', 'el-fasher', 'al-fashir', 'al fashir'], name: 'El Fasher', lat: 13.6279, lng: 25.3494, country: 'SD' },
  { terms: ['darfur'], name: 'Darfur', lat: 13.5, lng: 24.5, country: 'SD' },
  { terms: ['kordofan', 'el obeid', 'el-obeid'], name: 'El Obeid (Kordofan)', lat: 13.1843, lng: 30.2167, country: 'SD' },
  { terms: ['omdurman'], name: 'Omdurman', lat: 15.6445, lng: 32.4777, country: 'SD' },
  { terms: ['port sudan'], name: 'Port Sudan', lat: 19.6158, lng: 37.2164, country: 'SD' },
  { terms: ['wadi halfa', 'argeen', 'arqin', 'qustul'], name: 'Egypt–Sudan border crossings', lat: 21.8, lng: 31.35, country: 'SD' },
  { terms: ['gerd', 'grand ethiopian renaissance dam', 'renaissance dam'], name: 'GERD', lat: 11.215, lng: 35.0932, country: 'ET' },
  // Red Sea
  { terms: ['bab el-mandeb', 'bab al-mandab', 'bab el mandeb', 'bab-el-mandeb'], name: 'Bab el-Mandeb', lat: 12.58, lng: 43.33, country: 'YE' },
  { terms: ['hodeidah', 'hudaydah'], name: 'Hodeidah', lat: 14.7978, lng: 42.9545, country: 'YE' },
  { terms: ['aden'], name: 'Aden', lat: 12.7855, lng: 45.0187, country: 'YE' },
  { terms: ['jeddah'], name: 'Jeddah', lat: 21.4858, lng: 39.1925, country: 'SA' },
  { terms: ['neom'], name: 'NEOM', lat: 28.0, lng: 35.2, country: 'SA' },
  { terms: ['berbera'], name: 'Berbera', lat: 10.4396, lng: 45.0143, country: 'SO' },
  { terms: ['strait of hormuz', 'hormuz'], name: 'Strait of Hormuz', lat: 26.5667, lng: 56.25, country: 'IR' },
  // Frequent summit venues abroad
  { terms: ['new delhi'], name: 'New Delhi', lat: 28.6139, lng: 77.209, country: 'IN' },
  { terms: ['kazan'], name: 'Kazan', lat: 55.7963, lng: 49.1088, country: 'RU' },
  { terms: ['johannesburg'], name: 'Johannesburg', lat: -26.2041, lng: 28.0473, country: 'ZA' },
  { terms: ['rio de janeiro'], name: 'Rio de Janeiro', lat: -22.9068, lng: -43.1729, country: 'BR' },
  { terms: ['new york'], name: 'New York', lat: 40.7128, lng: -74.006, country: 'US' },
  { terms: ['davos'], name: 'Davos', lat: 46.8027, lng: 9.836, country: 'CH' },
  { terms: ['brussels'], name: 'Brussels', lat: 50.8503, lng: 4.3517, country: 'EU' },
  { terms: ['baghdad'], name: 'Baghdad', lat: 33.3152, lng: 44.3661, country: 'IQ' },
  { terms: ['manama'], name: 'Manama', lat: 26.2285, lng: 50.586, country: 'BH' },
  { terms: ['dubai'], name: 'Dubai', lat: 25.2048, lng: 55.2708, country: 'AE' },
];

const COUNTRY_BY_CODE = new Map(COUNTRIES.map(c => [c.code, c]));
export const countryByCode = (code: string) => COUNTRY_BY_CODE.get(code);
export const countryName = (code: string) => COUNTRY_BY_CODE.get(code)?.name ?? code;

export const CAIRO = { name: 'Cairo', lat: 30.0444, lng: 31.2357 };

/** Word-boundary match that treats multi-word and dotted terms sensibly. */
export function hasTerm(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Short all-caps-ish terms (us, uk, eu, un) need case-sensitive boundaries
  // in the original text to avoid matching "us" the pronoun.
  if (term.length <= 3 && /^[a-z.]+$/.test(term)) {
    const upper = escaped.toUpperCase();
    return new RegExp(`(^|[^A-Za-z])${upper}([^A-Za-z]|$)`).test(text);
  }
  return new RegExp(`(^|[^\\p{L}])${escaped}([^\\p{L}]|$)`, 'iu').test(text);
}

export function findCountries(text: string): string[] {
  const found = new Set<string>();
  for (const c of COUNTRIES) {
    if (c.terms.some(t => hasTerm(text, t))) found.add(c.code);
  }
  for (const l of LEADERS) {
    if (l.terms.some(t => hasTerm(text, t))) found.add(l.code);
  }
  return [...found];
}

/** Countries ordered by where they are first mentioned in the text. */
export function findCountriesOrdered(text: string): string[] {
  const hits: { code: string; at: number }[] = [];
  const firstIndex = (term: string) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = term.length <= 3 && /^[a-z.]+$/.test(term)
      ? new RegExp(`(^|[^A-Za-z])${escaped.toUpperCase()}([^A-Za-z]|$)`)
      : new RegExp(`(^|[^\\p{L}])${escaped}([^\\p{L}]|$)`, 'iu');
    const m = re.exec(text);
    return m ? m.index : -1;
  };
  for (const c of COUNTRIES) {
    const idx = c.terms.map(firstIndex).filter(i => i >= 0);
    if (idx.length) hits.push({ code: c.code, at: Math.min(...idx) });
  }
  for (const l of LEADERS) {
    const idx = l.terms.map(firstIndex).filter(i => i >= 0);
    if (idx.length) hits.push({ code: l.code, at: Math.min(...idx) });
  }
  hits.sort((a, b) => a.at - b.at);
  return [...new Set(hits.map(h => h.code))];
}

export function findLeaders(text: string): string[] {
  return LEADERS.filter(l => l.terms.some(t => hasTerm(text, t))).map(l => l.label);
}

/** First place mentioned, preferring the most specific (earliest listed). */
export function findPlace(text: string) {
  for (const p of PLACES) {
    if (p.terms.some(t => hasTerm(text, t))) return p;
  }
  return undefined;
}

export type Product = {
  id: string;
  name: string;
  sku: string;
  brand?: string;
  model?: string;
  color: string;
  description?: string;
  imageUrl?: string;
  imageSource?: "catalog";
  category: string;
  costPrice: number;
  sellingPrice: number;
  inStockQuantity: number;
  reorderLevel: number;
  vendorName: string;
  vendorContactNumber?: string;
  vendorCompany?: string;
  sold: number;
  received: number;
};

export type ProductModel = { name: string; category: string };
export type ProductBrand = { value: string; label: string; mark: string; models: ProductModel[] };

export const productBrands: ProductBrand[] = [
  { value: "apple", label: "Apple", mark: "", models: [{ name: "iPhone 15", category: "Mobiles" }, { name: "iPhone 16", category: "Mobiles" }, { name: "iPhone 16 Pro", category: "Mobiles" }, { name: "iPad Air", category: "Tablets" }, { name: "Apple Watch Series 10", category: "Smartwatches" }, { name: "AirPods Pro 2", category: "Audio" }, { name: "MagSafe Charger", category: "Chargers" }, { name: "USB-C Cable", category: "Cables" }, { name: "AirTag", category: "Accessories" }] },
  { value: "samsung", label: "Samsung", mark: "S", models: [{ name: "Galaxy A55", category: "Mobiles" }, { name: "Galaxy S24", category: "Mobiles" }, { name: "Galaxy S25", category: "Mobiles" }, { name: "Galaxy Tab S9", category: "Tablets" }, { name: "Galaxy Watch 7", category: "Smartwatches" }, { name: "Galaxy Buds 3", category: "Audio" }, { name: "25W Fast Charger", category: "Chargers" }, { name: "USB-C Cable", category: "Cables" }, { name: "SmartTag2", category: "Accessories" }] },
  { value: "xiaomi", label: "Xiaomi", mark: "mi", models: [{ name: "Redmi Note 13", category: "Mobiles" }, { name: "Redmi Note 14", category: "Mobiles" }, { name: "Xiaomi 14", category: "Mobiles" }, { name: "Xiaomi Pad 6", category: "Tablets" }, { name: "Xiaomi Watch 2", category: "Smartwatches" }, { name: "Redmi Buds 5", category: "Audio" }, { name: "67W Turbo Charger", category: "Chargers" }, { name: "Mi Band 9", category: "Accessories" }] },
  { value: "google", label: "Google", mark: "G", models: [{ name: "Pixel 8", category: "Mobiles" }, { name: "Pixel 9", category: "Mobiles" }, { name: "Pixel 9 Pro", category: "Mobiles" }, { name: "Pixel Tablet", category: "Tablets" }, { name: "Pixel Watch 3", category: "Smartwatches" }, { name: "Pixel Buds Pro 2", category: "Audio" }, { name: "30W USB-C Charger", category: "Chargers" }] },
  { value: "oneplus", label: "OnePlus", mark: "1+", models: [{ name: "OnePlus 12", category: "Mobiles" }, { name: "OnePlus 13", category: "Mobiles" }, { name: "OnePlus Nord 4", category: "Mobiles" }, { name: "OnePlus Pad 2", category: "Tablets" }, { name: "OnePlus Watch 2", category: "Smartwatches" }, { name: "OnePlus Buds Pro 3", category: "Audio" }, { name: "SUPERVOOC Charger", category: "Chargers" }] },
  { value: "nothing", label: "Nothing", mark: "N", models: [{ name: "Phone (2)", category: "Mobiles" }, { name: "Phone (3)", category: "Mobiles" }, { name: "Ear", category: "Audio" }, { name: "Power Adapter", category: "Chargers" }, { name: "Phone Case", category: "Accessories" }] },
  { value: "oppo", label: "Oppo", mark: "O", models: [{ name: "Reno 12", category: "Mobiles" }, { name: "Find X8", category: "Mobiles" }, { name: "Pad Neo", category: "Tablets" }, { name: "Watch X", category: "Smartwatches" }, { name: "Enco X3", category: "Audio" }, { name: "SUPERVOOC Charger", category: "Chargers" }] },
  { value: "vivo", label: "Vivo", mark: "V", models: [{ name: "V30", category: "Mobiles" }, { name: "V40", category: "Mobiles" }, { name: "X100", category: "Mobiles" }, { name: "Pad3", category: "Tablets" }, { name: "Watch 3", category: "Smartwatches" }, { name: "TWS 3e", category: "Audio" }] },
  { value: "huawei", label: "Huawei", mark: "H", models: [{ name: "Pura 70", category: "Mobiles" }, { name: "Mate 60 Pro", category: "Mobiles" }, { name: "MatePad  Pro", category: "Tablets" }, { name: "Watch GT 5", category: "Smartwatches" }, { name: "FreeBuds Pro 3", category: "Audio" }, { name: "SuperCharge Adapter", category: "Chargers" }] },
  { value: "honor", label: "Honor", mark: "H", models: [{ name: "Magic6 Pro", category: "Mobiles" }, { name: "200 Pro", category: "Mobiles" }, { name: "MagicPad 2", category: "Tablets" }, { name: "Watch 4 Pro", category: "Smartwatches" }, { name: "Choice Earbuds X5", category: "Audio" }] },
  { value: "motorola", label: "Motorola", mark: "M", models: [{ name: "Edge 50 Pro", category: "Mobiles" }, { name: "Razr 50 Ultra", category: "Mobiles" }, { name: "Moto G85", category: "Mobiles" }, { name: "Moto Tab G70", category: "Tablets" }, { name: "Moto Buds+", category: "Audio" }] },
  { value: "sony", label: "Sony", mark: "S", models: [{ name: "Xperia 1 VI", category: "Mobiles" }, { name: "Xperia 10 VI", category: "Mobiles" }, { name: "WH-1000XM5", category: "Audio" }, { name: "WF-1000XM5", category: "Audio" }, { name: "65W Charger", category: "Chargers" }] },
  { value: "nokia", label: "Nokia", mark: "N", models: [{ name: "G42 5G", category: "Mobiles" }, { name: "X30 5G", category: "Mobiles" }, { name: "T21", category: "Tablets" }, { name: "Nokia Clarity Earbuds", category: "Audio" }] },
  { value: "realme", label: "Realme", mark: "R", models: [{ name: "GT 6", category: "Mobiles" }, { name: "12 Pro+", category: "Mobiles" }, { name: "Pad 2", category: "Tablets" }, { name: "Watch S2", category: "Smartwatches" }, { name: "Buds Air 6", category: "Audio" }, { name: "SUPERVOOC Charger", category: "Chargers" }] },
  { value: "tecno", label: "Tecno", mark: "T", models: [{ name: "Camon 30 Pro", category: "Mobiles" }, { name: "Phantom V Fold2", category: "Mobiles" }, { name: "Megapad 11", category: "Tablets" }, { name: "Watch Pro 2", category: "Smartwatches" }, { name: "True 1", category: "Audio" }] },
  { value: "infinix", label: "Infinix", mark: "I", models: [{ name: "Zero 40", category: "Mobiles" }, { name: "Note 40 Pro", category: "Mobiles" }, { name: "Xpad", category: "Tablets" }, { name: "Xwatch 3 Plus", category: "Smartwatches" }, { name: "XE27 Earbuds", category: "Audio" }] },
  { value: "asus", label: "ASUS", mark: "A", models: [{ name: "ROG Phone 8", category: "Mobiles" }, { name: "Zenfone 11 Ultra", category: "Mobiles" }, { name: "ROG Flow Z13", category: "Tablets" }, { name: "ROG Cetra", category: "Audio" }, { name: "65W GaN Charger", category: "Chargers" }] },
  { value: "lenovo", label: "Lenovo", mark: "L", models: [{ name: "Legion Phone Duel", category: "Mobiles" }, { name: "Tab P12", category: "Tablets" }, { name: "Yoga Tab 13", category: "Tablets" }, { name: "Smart Clock", category: "Accessories" }, { name: "USB-C Hub", category: "Accessories" }] },
  { value: "jbl", label: "JBL", mark: "J", models: [{ name: "Charge 5", category: "Audio" }, { name: "Flip 6", category: "Audio" }, { name: "Tune 770NC", category: "Audio" }, { name: "USB-C Audio Cable", category: "Cables" }] },
  { value: "bose", label: "Bose", mark: "B", models: [{ name: "QuietComfort Ultra", category: "Audio" }, { name: "SoundLink Flex", category: "Audio" }, { name: "QuietComfort Earbuds II", category: "Audio" }, { name: "USB-C Cable", category: "Cables" }] },
  { value: "anker", label: "Anker", mark: "A", models: [{ name: "Prime Power Bank", category: "Accessories" }, { name: "Nano Charger", category: "Chargers" }, { name: "PowerLine III Cable", category: "Cables" }, { name: "Soundcore Liberty 4", category: "Audio" }] },
  { value: "belkin", label: "Belkin", mark: "B", models: [{ name: "BoostCharge Pro", category: "Chargers" }, { name: "3-in-1 MagSafe Charger", category: "Chargers" }, { name: "USB-C Cable", category: "Cables" }, { name: "iPhone Screen Protector", category: "Accessories" }] },
  { value: "ugreen", label: "UGREEN", mark: "U", models: [{ name: "Nexode Charger", category: "Chargers" }, { name: "USB-C to USB-C Cable", category: "Cables" }, { name: "USB-C Hub", category: "Accessories" }, { name: "HiTune Max 5C", category: "Audio" }] },
  { value: "other", label: "Other brand", mark: "···", models: [{ name: "Custom mobile", category: "Mobiles" }, { name: "Custom tablet", category: "Tablets" }, { name: "Custom accessory", category: "Accessories" }, { name: "Custom charger", category: "Chargers" }, { name: "Custom cable", category: "Cables" }, { name: "Custom audio product", category: "Audio" }, { name: "Custom smartwatch", category: "Smartwatches" }] },
];

// Clearbit's logo endpoint is domain-based. Keep domains explicit because brand
// values such as `vivo`, `honor`, and `tecno` do not always match their websites.
export const brandLogoDomains: Record<string, string> = {
  apple: "apple.com",
  samsung: "samsung.com",
  xiaomi: "xiaomi.com",
  google: "google.com",
  oneplus: "oneplus.com",
  nothing: "nothing.tech",
  oppo: "oppo.com",
  vivo: "vivo.com",
  huawei: "huawei.com",
  honor: "honor.com",
  motorola: "motorola.com",
  sony: "sony.com",
  nokia: "nokia.com",
  realme: "realme.com",
  tecno: "tecno-mobile.com",
  infinix: "infinixmobility.com",
  asus: "asus.com",
  lenovo: "lenovo.com",
  jbl: "jbl.com",
  bose: "bose.com",
  anker: "anker.com",
  belkin: "belkin.com",
  ugreen: "ugreen.com",
};

// Keep the selector useful for both older inventory and current retail stock.
// These are model families and named product variants; the Other brand fallback
// remains available for any SKU that is not in this curated catalog.
const catalogAdditions: Record<string, Partial<Record<ProductModel["category"], string[]>>> = {
  apple: { Mobiles: ["iPhone", "iPhone 3G", "iPhone 3GS", "iPhone 4", "iPhone 4S", "iPhone 5", "iPhone 5c", "iPhone 5s", "iPhone 6", "iPhone 6 Plus", "iPhone 6s", "iPhone 6s Plus", "iPhone SE", "iPhone 7", "iPhone 7 Plus", "iPhone 8", "iPhone 8 Plus", "iPhone X", "iPhone XR", "iPhone XS", "iPhone XS Max", "iPhone 11", "iPhone 11 Pro", "iPhone 11 Pro Max", "iPhone SE (2nd generation)", "iPhone 12 mini", "iPhone 12", "iPhone 12 Pro", "iPhone 12 Pro Max", "iPhone 13 mini", "iPhone 13", "iPhone 13 Pro", "iPhone 13 Pro Max", "iPhone SE (3rd generation)", "iPhone 14", "iPhone 14 Plus", "iPhone 14 Pro", "iPhone 14 Pro Max", "iPhone 15 Plus", "iPhone 15 Pro", "iPhone 15 Pro Max", "iPhone 16 Plus", "iPhone 16 Pro Max"], Tablets: ["iPad", "iPad 2", "iPad Air", "iPad Air 2", "iPad Air (3rd generation)", "iPad Air (4th generation)", "iPad Air (5th generation)", "iPad Air 11-inch (M2)", "iPad mini", "iPad mini 2", "iPad mini 4", "iPad mini (6th generation)", "iPad Pro 11-inch", "iPad Pro 12.9-inch", "iPad Pro 11-inch (M4)", "iPad Pro 13-inch (M4)"], Smartwatches: ["Apple Watch", "Apple Watch Series 1", "Apple Watch Series 2", "Apple Watch Series 3", "Apple Watch Series 4", "Apple Watch Series 5", "Apple Watch SE", "Apple Watch Series 6", "Apple Watch Series 7", "Apple Watch Series 8", "Apple Watch Ultra", "Apple Watch Series 9", "Apple Watch Ultra 2"], Audio: ["EarPods", "AirPods", "AirPods 2", "AirPods 3", "AirPods 4", "AirPods Pro", "AirPods Pro 2", "AirPods Max"] },
  samsung: { Mobiles: ["Galaxy S", "Galaxy S II", "Galaxy S III", "Galaxy S4", "Galaxy S5", "Galaxy S6", "Galaxy S7", "Galaxy S8", "Galaxy S9", "Galaxy S10", "Galaxy S20", "Galaxy S21", "Galaxy S22", "Galaxy S23", "Galaxy S24", "Galaxy S25", "Galaxy Note", "Galaxy Note II", "Galaxy Note 3", "Galaxy Note 4", "Galaxy Note 5", "Galaxy Note 8", "Galaxy Note 9", "Galaxy Note 10", "Galaxy Note 20", "Galaxy Z Fold", "Galaxy Z Fold2", "Galaxy Z Fold3", "Galaxy Z Fold4", "Galaxy Z Fold5", "Galaxy Z Fold6", "Galaxy Z Flip", "Galaxy Z Flip3", "Galaxy Z Flip4", "Galaxy Z Flip5", "Galaxy Z Flip6", "Galaxy A10", "Galaxy A20", "Galaxy A30", "Galaxy A50", "Galaxy A51", "Galaxy A52", "Galaxy A53", "Galaxy A54", "Galaxy A55", "Galaxy M31", "Galaxy M51"], Tablets: ["Galaxy Tab", "Galaxy Tab 2", "Galaxy Tab 3", "Galaxy Tab S", "Galaxy Tab S2", "Galaxy Tab S3", "Galaxy Tab S4", "Galaxy Tab S5e", "Galaxy Tab S6", "Galaxy Tab S7", "Galaxy Tab S8", "Galaxy Tab S9", "Galaxy Tab S10", "Galaxy Tab A", "Galaxy Tab A7", "Galaxy Tab A8", "Galaxy Tab A9", "Galaxy Tab Active"], Smartwatches: ["Galaxy Gear", "Gear S2", "Gear S3", "Galaxy Watch", "Galaxy Watch Active", "Galaxy Watch Active2", "Galaxy Watch3", "Galaxy Watch4", "Galaxy Watch5", "Galaxy Watch6", "Galaxy Watch7", "Galaxy Watch Ultra"], Audio: ["Galaxy Buds", "Galaxy Buds+", "Galaxy Buds Live", "Galaxy Buds Pro", "Galaxy Buds2", "Galaxy Buds2 Pro", "Galaxy Buds3", "Galaxy Buds3 Pro"] },
  xiaomi: { Mobiles: ["Mi 1", "Mi 2", "Mi 3", "Mi 4", "Mi 5", "Mi 6", "Mi 8", "Mi 9", "Mi 10", "Mi 11", "Mi 12", "Mi 13", "Mi 14", "Mi 15", "Redmi 1", "Redmi 2", "Redmi 3", "Redmi 4", "Redmi 5", "Redmi 6", "Redmi 7", "Redmi 8", "Redmi 9", "Redmi 10", "Redmi 12", "Redmi 13", "Redmi Note", "Redmi Note 7", "Redmi Note 8", "Redmi Note 9", "Redmi Note 10", "Redmi Note 11", "Redmi Note 12", "Redmi Note 13", "Redmi Note 14", "Poco F1", "Poco F2 Pro", "Poco F3", "Poco F4", "Poco F5", "Poco F6", "Poco X3", "Poco X4 Pro", "Poco X5 Pro", "Poco X6 Pro", "Poco M6 Pro"], Tablets: ["Mi Pad", "Mi Pad 2", "Mi Pad 3", "Mi Pad 4", "Mi Pad 5", "Xiaomi Pad 5", "Xiaomi Pad 6", "Xiaomi Pad 6S Pro", "Redmi Pad", "Redmi Pad SE"], Smartwatches: ["Mi Watch", "Mi Watch Lite", "Mi Watch Color", "Xiaomi Watch S1", "Xiaomi Watch S2", "Xiaomi Watch 2", "Redmi Watch 3", "Redmi Watch 4", "Mi Band", "Mi Band 5", "Mi Band 6", "Mi Band 7", "Mi Band 8", "Mi Band 9"], Audio: ["Mi True Wireless Earphones", "Redmi Buds 3", "Redmi Buds 4", "Redmi Buds 5", "Xiaomi Buds 4", "Xiaomi Buds 5"] },
  google: { Mobiles: ["Google Nexus One", "Nexus S", "Galaxy Nexus", "Nexus 4", "Nexus 5", "Nexus 5X", "Nexus 6", "Nexus 6P", "Pixel", "Pixel 2", "Pixel 3", "Pixel 3a", "Pixel 4", "Pixel 4a", "Pixel 5", "Pixel 5a", "Pixel 6", "Pixel 6a", "Pixel 6 Pro", "Pixel 7", "Pixel 7a", "Pixel 7 Pro", "Pixel 8", "Pixel 8a", "Pixel 8 Pro", "Pixel 9", "Pixel 9 Pro", "Pixel 9 Pro XL"], Tablets: ["Nexus 7", "Nexus 9", "Pixel Tablet"], Smartwatches: ["Pixel Watch", "Pixel Watch 2", "Pixel Watch 3"], Audio: ["Pixel Buds", "Pixel Buds A-Series", "Pixel Buds Pro", "Pixel Buds Pro 2"] },
  oneplus: { Mobiles: ["OnePlus One", "OnePlus 2", "OnePlus X", "OnePlus 3", "OnePlus 3T", "OnePlus 5", "OnePlus 5T", "OnePlus 6", "OnePlus 6T", "OnePlus 7", "OnePlus 7 Pro", "OnePlus 7T", "OnePlus 8", "OnePlus 8 Pro", "OnePlus 8T", "OnePlus 9", "OnePlus 9 Pro", "OnePlus 9RT", "OnePlus 10 Pro", "OnePlus 10T", "OnePlus 11", "OnePlus 11R", "OnePlus 12", "OnePlus 12R", "OnePlus 13", "OnePlus Nord", "OnePlus Nord 2", "OnePlus Nord 3", "OnePlus Nord 4", "OnePlus Nord CE", "OnePlus Nord CE 3", "OnePlus Nord CE 4"], Tablets: ["OnePlus Pad", "OnePlus Pad Go", "OnePlus Pad 2"], Smartwatches: ["OnePlus Watch", "OnePlus Watch 2", "OnePlus Watch 2R"], Audio: ["OnePlus Buds", "OnePlus Buds Z", "OnePlus Buds Pro", "OnePlus Buds Pro 2", "OnePlus Buds Pro 3", "OnePlus Nord Buds"] },
  nothing: { Mobiles: ["Nothing Phone (1)", "Nothing Phone (2)", "Nothing Phone (2a)", "Nothing Phone (2a) Plus", "Nothing Phone (3)"], Audio: ["Ear (1)", "Ear (2)", "Ear", "Ear (a)", "Nothing Headphone (1)"], Accessories: ["Glyph Case", "Nothing Phone Case", "Nothing Power Bank"] },
  oppo: { Mobiles: ["Oppo A3", "Oppo A5", "Oppo A9", "Oppo A15", "Oppo A16", "Oppo A54", "Oppo A57", "Oppo A78", "Oppo F1", "Oppo F3", "Oppo F5", "Oppo F7", "Oppo F9", "Oppo F11", "Oppo Find X", "Find X2", "Find X3 Pro", "Find X5 Pro", "Find X6 Pro", "Find X7 Ultra", "Find X8", "Reno", "Reno 2", "Reno 4", "Reno 6", "Reno 8", "Reno 10", "Reno 11", "Reno 12"], Tablets: ["Oppo Pad", "Oppo Pad Air", "Oppo Pad 2", "Oppo Pad Neo"], Smartwatches: ["Oppo Watch", "Oppo Watch Free", "Oppo Watch 3 Pro", "Watch X"], Audio: ["Enco Free", "Enco Air", "Enco X", "Enco X2", "Enco X3"] },
  vivo: { Mobiles: ["Vivo V5", "Vivo V7", "Vivo V9", "Vivo V11", "Vivo V15", "Vivo V17", "Vivo V20", "Vivo V21", "Vivo V23", "Vivo V25", "Vivo V27", "Vivo V29", "Vivo V30", "Vivo V40", "Vivo X50", "Vivo X60", "Vivo X70", "Vivo X80", "Vivo X90", "Vivo X100", "Vivo X200", "Vivo Y12", "Vivo Y15", "Vivo Y20", "Vivo Y21", "Vivo Y22", "Vivo Y35", "Vivo Y36", "Vivo Y100"], Tablets: ["Vivo Pad", "Vivo Pad2", "Vivo Pad3"], Smartwatches: ["Vivo Watch", "Vivo Watch 2", "Vivo Watch 3"], Audio: ["Vivo TWS", "Vivo TWS 2", "Vivo TWS 3", "Vivo TWS 3e"] },
  huawei: { Mobiles: ["Huawei Ascend P1", "Ascend P6", "Ascend P7", "P8", "P9", "P10", "P20", "P30", "P40", "P50", "P60", "Pura 70", "Mate 7", "Mate 8", "Mate 9", "Mate 10", "Mate 20", "Mate 30", "Mate 40", "Mate 50", "Mate 60 Pro", "Mate X", "Mate X2", "Mate X3", "Mate X5"], Tablets: ["MediaPad", "MediaPad M5", "MatePad", "MatePad Pro", "MatePad 11", "MatePad 11.5"], Smartwatches: ["Huawei Watch", "Watch GT", "Watch GT 2", "Watch GT 3", "Watch GT 4", "Watch GT 5", "Watch 3", "Watch 4"], Audio: ["FreeBuds", "FreeBuds 3", "FreeBuds 4", "FreeBuds Pro", "FreeBuds Pro 2", "FreeBuds Pro 3"] },
  honor: { Mobiles: ["Honor 6", "Honor 7", "Honor 8", "Honor 9", "Honor 10", "Honor 20", "Honor 30", "Honor 50", "Honor 70", "Honor 90", "Honor 100", "Honor 200 Pro", "Magic", "Magic3 Pro", "Magic4 Pro", "Magic5 Pro", "Magic6 Pro", "Magic V", "Magic V2", "Magic V3", "X5 Plus", "X7b", "X8b"], Tablets: ["Honor Pad 5", "Honor Pad 8", "Honor Pad 9", "MagicPad 13", "MagicPad 2"], Smartwatches: ["Honor Watch", "Watch GS Pro", "Watch 4", "Watch 4 Pro", "Watch 5"], Audio: ["Honor Choice Earbuds X", "Choice Earbuds X5", "Earbuds 2 Lite"] },
  motorola: { Mobiles: ["Moto G", "Moto G2", "Moto G3", "Moto G4", "Moto G5", "Moto G6", "Moto G7", "Moto G8", "Moto G9", "Moto G10", "Moto G20", "Moto G30", "Moto G40", "Moto G50", "Moto G60", "Moto G70", "Moto G85", "Moto X", "Moto X2", "Moto X4", "Moto Z", "Moto Z2", "Motorola One", "One Fusion", "One Vision", "Edge", "Edge 20", "Edge 30", "Edge 40", "Edge 50 Pro", "Razr", "Razr 5G", "Razr 40", "Razr 50 Ultra"], Tablets: ["Moto Tab", "Moto Tab G70", "Moto Tab G62"], Audio: ["Moto Buds", "Moto Buds+", "Moto Buds 600"] },
  sony: { Mobiles: ["Xperia X10", "Xperia Z", "Xperia Z1", "Xperia Z2", "Xperia Z3", "Xperia X", "Xperia XZ", "Xperia XZ1", "Xperia 1", "Xperia 1 II", "Xperia 1 III", "Xperia 1 IV", "Xperia 1 V", "Xperia 1 VI", "Xperia 5", "Xperia 5 II", "Xperia 5 III", "Xperia 5 IV", "Xperia 10", "Xperia 10 II", "Xperia 10 V", "Xperia 10 VI"], Audio: ["MDR-1000X", "WH-1000XM2", "WH-1000XM3", "WH-1000XM4", "WH-1000XM5", "WF-1000XM3", "WF-1000XM4", "WF-1000XM5", "LinkBuds", "LinkBuds S", "ULT Wear"] },
  nokia: { Mobiles: ["Nokia 3310", "Nokia 1100", "Nokia N95", "Nokia N8", "Lumia 520", "Lumia 630", "Lumia 920", "Lumia 1020", "Nokia 1", "Nokia 2", "Nokia 3", "Nokia 5", "Nokia 6", "Nokia 7 Plus", "Nokia 8", "Nokia 9 PureView", "Nokia G10", "Nokia G20", "Nokia G21", "Nokia G42 5G", "Nokia X10", "Nokia X20", "Nokia X30 5G"], Tablets: ["Nokia T20", "Nokia T21"], Audio: ["Nokia Clarity Earbuds", "Nokia Essential Wireless Earphones"] },
  realme: { Mobiles: ["Realme 1", "Realme 2", "Realme 3", "Realme 5", "Realme 6", "Realme 7", "Realme 8", "Realme 9", "Realme 10", "Realme 11", "Realme 12", "Realme 13", "Realme C1", "Realme C3", "Realme C11", "Realme C25", "Realme C35", "Realme C55", "Realme C67", "Realme GT", "GT Neo", "GT 2", "GT 3", "GT 5", "GT 6", "Realme X", "Realme X2", "Realme X50", "Realme Narzo 10", "Narzo 20", "Narzo 30", "Narzo 50"], Tablets: ["Realme Pad", "Realme Pad Mini", "Realme Pad 2"], Smartwatches: ["Realme Watch", "Watch 2", "Watch 3", "Watch S", "Watch S2"], Audio: ["Buds Air", "Buds Air 2", "Buds Air 3", "Buds Air 5", "Buds Air 6", "Buds Wireless"] },
  asus: { Mobiles: ["Asus Zenfone", "Zenfone 2", "Zenfone 3", "Zenfone 4", "Zenfone 5", "Zenfone 6", "Zenfone 7", "Zenfone 8", "Zenfone 9", "Zenfone 10", "Zenfone 11 Ultra", "ROG Phone", "ROG Phone 2", "ROG Phone 3", "ROG Phone 5", "ROG Phone 6", "ROG Phone 7", "ROG Phone 8"], Tablets: ["Eee Pad", "ZenPad", "ZenPad 3S", "ROG Flow Z13"], Audio: ["ROG Cetra", "ROG Delta", "ZenEar"] },
  lenovo: { Mobiles: ["Lenovo K3 Note", "Lenovo K4 Note", "Lenovo Z2 Plus", "Legion Phone Duel", "Legion Phone Duel 2"], Tablets: ["IdeaTab", "Yoga Tablet", "Yoga Tab 3", "Yoga Tab 13", "Tab M7", "Tab M8", "Tab M10", "Tab P11", "Tab P12", "Legion Tab"], Accessories: ["Lenovo Smart Clock", "ThinkPad USB-C Dock", "Lenovo USB-C Hub"] },
  jbl: { Audio: ["JBL Go", "JBL Go 2", "JBL Go 3", "JBL Flip", "JBL Flip 4", "JBL Flip 5", "JBL Flip 6", "JBL Charge", "JBL Charge 3", "JBL Charge 4", "JBL Charge 5", "JBL Xtreme", "JBL Boombox", "JBL Tune 500", "JBL Tune 510BT", "JBL Tune 770NC", "JBL Live 660NC", "JBL PartyBox"] },
  bose: { Audio: ["Bose QuietComfort", "QuietComfort 25", "QuietComfort 35", "QuietComfort 45", "QuietComfort Ultra", "Bose 700", "SoundLink Mini", "SoundLink Color", "SoundLink Flex", "SoundLink Revolve", "Bose Sport Earbuds", "QuietComfort Earbuds", "QuietComfort Earbuds II", "Ultra Open Earbuds"] },
  anker: { Accessories: ["PowerCore", "PowerCore Essential", "Prime Power Bank", "MagGo Power Bank", "Eufy Smart Tracker"], Chargers: ["PowerPort", "PowerPort III", "Nano Charger", "Nano II Charger", "Prime Charger"], Cables: ["PowerLine", "PowerLine II", "PowerLine III Cable", "Bio-Based Cable"], Audio: ["Soundcore Life Q20", "Soundcore Life Q30", "Soundcore Liberty Air", "Soundcore Liberty 4", "Soundcore Space Q45"] },
  belkin: { Chargers: ["BoostCharge", "BoostCharge Pro", "MagSafe Charger", "3-in-1 MagSafe Charger", "Wireless Charging Stand"], Cables: ["Mixit-Up Cable", "BoostCharge USB-C Cable", "Thunderbolt 4 Cable"], Accessories: ["ScreenForce", "MagSafe Car Vent Mount", "USB-C Multimedia Hub", "Connect Pro Dock"] },
  ugreen: { Chargers: ["Nexode 45W", "Nexode 65W", "Nexode 100W", "Nexode 140W", "CD244 Charger"], Cables: ["US287 Cable", "USB-C to USB-C Cable", "USB-C to Lightning Cable", "HDMI Cable"], Accessories: ["USB-C Hub", "Revodok Hub", "NVMe Enclosure", "Laptop Stand"], Audio: ["HiTune T3", "HiTune Max 5C"] },
};

// Current-generation additions. Keep these separate from the historical catalog
// above so the selector contains both older inventory and the latest retail lines.
const currentCatalogAdditions: Record<string, Partial<Record<ProductModel["category"], string[]>>> = {
  apple: {
    Mobiles: ["iPhone 17", "iPhone 17 Pro", "iPhone 17 Pro Max", "iPhone 17e", "iPhone Air", "iPhone 18 Pro", "iPhone 18 Pro Max", "iPhone Duo"],
    Tablets: ["iPad (A16)", "iPad mini (A17 Pro)", "iPad Air 11-inch (M3)", "iPad Air 13-inch (M3)", "iPad Air 11-inch (M4)", "iPad Air 13-inch (M4)", "iPad Pro 11-inch (M5)", "iPad Pro 13-inch (M5)"],
    Smartwatches: ["Apple Watch Series 11", "Apple Watch SE 3", "Apple Watch Ultra 3", "Apple Watch Hermès Series 11", "Apple Watch Hermès Ultra 3"],
    Audio: ["AirPods Pro 3"],
  },
  samsung: {
    Mobiles: ["Galaxy S26", "Galaxy S26+", "Galaxy S26 Ultra", "Galaxy S26 FE", "Galaxy Z Fold8 Ultra", "Galaxy Z Fold8", "Galaxy Z Flip8", "Galaxy A57 5G", "Galaxy A37 5G"],
    Tablets: ["Galaxy Tab S11", "Galaxy Tab S11 Ultra"],
    Smartwatches: ["Galaxy Watch9", "Galaxy Watch Ultra2"],
    Audio: ["Galaxy Buds4", "Galaxy Buds4 Pro"],
  },
  google: {
    Mobiles: ["Pixel 10a", "Pixel 11", "Pixel 11 Pro", "Pixel 11 Pro XL", "Pixel 11 Pro Fold"],
    Smartwatches: ["Pixel Watch 4"],
  },
  xiaomi: {
    Mobiles: ["Xiaomi 17", "Xiaomi 17 Pro", "Xiaomi 17 Pro Max", "Xiaomi 17 Ultra", "Xiaomi 17 Max", "Xiaomi 17T", "Xiaomi 17T Pro"],
    Tablets: ["Xiaomi Pad 7", "Xiaomi Pad 7 Pro"],
    Smartwatches: ["Xiaomi Watch S4"],
    Audio: ["Xiaomi Buds 5 Pro"],
  },
  oneplus: {
    Mobiles: ["OnePlus 15", "OnePlus 15R"],
    Tablets: ["OnePlus Pad 3"],
    Smartwatches: ["OnePlus Watch 3"],
    Audio: ["OnePlus Buds Pro 4"],
  },
  oppo: {
    Mobiles: ["Find X9", "Find X9 Pro", "Find X9s", "Find X9 Ultra", "Reno 14", "Reno 14 Pro"],
    Tablets: ["OPPO Pad 5"],
    Smartwatches: ["OPPO Watch X2"],
    Audio: ["Enco X4", "Enco Air5 Pro"],
  },
  vivo: {
    Mobiles: ["vivo X300", "vivo X300 Pro", "vivo X300 Ultra", "vivo V60"],
    Tablets: ["vivo Pad5"],
    Smartwatches: ["vivo Watch 5"],
    Audio: ["vivo TWS 5"],
  },
  huawei: {
    Mobiles: ["HUAWEI Pura 90s Pro Max", "HUAWEI Pura 90s Pro", "HUAWEI Pura 90 Pro Max", "HUAWEI Pura 90 Pro", "HUAWEI Pura 90", "HUAWEI Pura X View", "HUAWEI Pura X Max", "HUAWEI Mate 90 Pro Max", "HUAWEI Mate 90 RS", "HUAWEI Mate 90 Pro", "HUAWEI Mate 90", "HUAWEI Mate XT 2", "HUAWEI Mate 80 Pro Max", "HUAWEI Mate X7", "HUAWEI Mate 80 RS", "HUAWEI Mate XTs", "HUAWEI Mate 80"],
    Tablets: ["HUAWEI MatePad Air"],
    Smartwatches: ["HUAWEI Watch 5"],
    Audio: ["HUAWEI FreeClip 2 S"],
  },
  honor: {
    Mobiles: ["HONOR Magic8", "HONOR Magic8 Pro", "HONOR Magic8 RSR Porsche Design", "HONOR Magic V5"],
    Tablets: ["HONOR MagicPad 3"],
    Smartwatches: ["HONOR Watch 5 Ultra"],
    Audio: ["HONOR Earbuds Open"],
  },
  motorola: {
    Mobiles: ["motorola edge 70", "motorola razr 70", "motorola razr ultra", "moto g stylus (2026)"],
    Audio: ["moto buds 2 plus", "moto buds loop"],
  },
  sony: {
    Mobiles: ["Xperia VIII", "Xperia 1 VII", "Xperia 10 VII"],
    Audio: ["WH-1000XM6", "WF-1000XM6"],
  },
  realme: {
    Mobiles: ["realme GT 7", "realme GT 7 Pro", "realme GT 8", "realme GT 8 Pro", "realme Neo8", "realme 15", "realme 15 Pro", "realme 15T"],
    Audio: ["realme Buds Air7", "realme Buds Air7 Pro", "realme Buds Air8", "realme Buds Wireless 5 ANC", "realme Buds T200"],
  },
  tecno: {
    Mobiles: ["CAMON 50 Ultra 5G", "CAMON 40 Pro 5G", "CAMON 40 Premier 5G", "POVA 8 Pro 5G", "POVA 7 Ultra 5G", "SPARK 40 Pro+", "PHANTOM V Flip 5G"],
  },
  infinix: {
    Mobiles: ["NOTE 60 Ultra", "NOTE 60 Pro", "NOTE Edge", "HOT 70 Pro 5G+", "HOT 70", "GT 50 Pro", "GT 30 Pro", "SMART 20"],
    Tablets: ["XPAD 20 Pro"],
  },
  asus: {
    Mobiles: ["ROG Phone 9", "Zenfone 12 Ultra"],
    Tablets: ["ROG Flow Z13 (2025)"],
  },
  lenovo: {
    Tablets: ["Legion Tab Gen 3", "Legion Tab Gen 5", "Idea Tab Pro Gen 2", "Idea Tab Plus 5G"],
  },
  jbl: {
    Audio: ["JBL Charge 6", "JBL Flip 7", "JBL Tour Pro 3", "JBL Live Beam 3"],
  },
  bose: {
    Audio: ["QuietComfort Ultra Headphones (2nd Gen)", "QuietComfort Ultra Earbuds (2nd Gen)", "SoundLink Max"],
  },
  anker: {
    Accessories: ["Prime Power Bank 27,650mAh"],
    Chargers: ["Prime Charger 300W", "Nano Charger Pro"],
    Audio: ["Soundcore Liberty 5", "Soundcore Space One Pro"],
  },
  belkin: {
    Chargers: ["BoostCharge Pro 3-in-1 Wireless Charging Pad", "BoostCharge Pro 2-in-1 MagSafe Charger"],
    Cables: ["Braided USB-C Cable 240W"],
    Accessories: ["Auto-Tracking Stand Pro"],
  },
  ugreen: {
    Chargers: ["Nexode 300W GaN Charger", "Nexode Pro 160W GaN Charger"],
    Cables: ["USB4 240W Cable"],
    Accessories: ["Revodok Pro USB-C Docking Station"],
  },
};

for (const brand of productBrands) {
  const existing = new Set(brand.models.map((model) => `${model.category}:${model.name}`));
  for (const additions of [catalogAdditions[brand.value], currentCatalogAdditions[brand.value]]) {
    if (!additions) continue;
    for (const [category, names] of Object.entries(additions)) {
      for (const name of names ?? []) {
        if (!existing.has(`${category}:${name}`)) {
          brand.models.push({ name, category });
          existing.add(`${category}:${name}`);
        }
      }
    }
  }
}

// Keep finishes tied to the exact device model where the manufacturer publishes
// a named color lineup. The category fallback keeps the dropdown useful for
// custom and older catalog entries without pretending every color is model-specific.
const modelColors: Record<string, string[]> = {
  "apple:iPhone 15": ["Black", "Green", "Yellow", "Pink", "Blue"],
  "apple:iPhone 16": ["Black", "White", "Pink", "Teal", "Ultramarine"],
  "apple:iPhone 16 Pro": ["Black Titanium", "Natural Titanium", "White Titanium", "Desert Titanium"],
  "apple:iPhone 17": ["Black", "White", "Mist Blue", "Sage", "Lavender"],
  "apple:iPhone 17e": ["Soft Pink", "White", "Black"],
  "apple:iPhone Air": ["Sky Blue", "Cloud White", "Space Black", "Light Gold"],
  "apple:iPhone 18 Pro": ["Black", "Silver", "Glacier", "Burgundy"],
  "apple:iPhone 18 Pro Max": ["Black", "Silver", "Glacier", "Burgundy"],
  "samsung:Galaxy S26 Ultra": ["Black", "White", "Cobalt Violet", "Sky Blue"],
  "google:Pixel 11": ["Obsidian", "Porcelain", "Hazel"],
};

const categoryColors: Record<string, string[]> = {
  Mobiles: ["Black", "White", "Silver", "Blue", "Green", "Gold", "Pink", "Purple", "Red"],
  Tablets: ["Black", "Silver", "Gray", "Blue", "Purple", "Gold"],
  Smartwatches: ["Black", "Silver", "Gold", "Rose Gold", "Blue", "Green"],
  Audio: ["Black", "White", "Silver", "Blue", "Pink", "Green"],
  Chargers: ["Black", "White", "Gray", "Blue"],
  Cables: ["Black", "White", "Gray", "Blue", "Red"],
  Accessories: ["Black", "White", "Gray", "Blue", "Green", "Pink"],
};

export function getProductColorOptions(brand: string | undefined, model: string | undefined, category: string, currentColor?: string) {
  const options = modelColors[`${brand ?? "other"}:${model ?? ""}`] ?? categoryColors[category] ?? ["Black", "White", "Gray"];
  return currentColor && !options.includes(currentColor) ? [...options, currentColor] : options;
}

export type SaleLineItem = {
  productId: string;
  name: string;
  sku: string;
  color?: string;
  quantity: number;
  unitSellingPrice: number;
  unitCost: number;
  discount: number;
  amount: number;
  profit: number;
};

export type Customer = {
  id: string;
  name: string;
  contactNumber: string;
  gender?: string;
  cnicNumber?: string;
  code: string;
  createdAt: string;
};

export type Supplier = {
  id: string;
  name: string;
  contactNumber: string;
  company: string;
  cnicNumber?: string;
  openingBalance?: number;
  createdAt: string;
};

export type SupplierPayment = {
  id: string;
  supplierId: string;
  amount: number;
  note?: string;
  date: string;
  time: string;
  createdAt?: string;
  capitalId?: string;
};

export type Expense = {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  month: string;
  paymentMethod?: string;
  note?: string;
  capitalId?: string;
  createdAt?: string;
};

export const defaultExpenseCategories = ["Rent", "Utilities", "Salaries", "Transport", "Marketing", "Repairs", "Office supplies", "Other"];

export type CapitalAccount = {
  id: string;
  name: string;
  ownerName?: string;
  createdAt: string;
};

export type CapitalEntry = {
  id: string;
  capitalId: string;
  type: "contribution" | "withdrawal";
  amount: number;
  date: string;
  month: string;
  note?: string;
  createdAt: string;
};

export type Transaction = {
  id: string;
  type: "sale" | "purchase" | "transfer";
  name: string;
  party: string;
  quantity: number;
  amount: number;
  profit?: number;
  time: string;
  date: string;
  month: string;
  items?: SaleLineItem[];
  customerId?: string;
  supplierId?: string;
  customerContactNumber?: string;
  customerCode?: string;
  customerAccountNumber?: string;
  supplierContactNumber?: string;
  supplierCompany?: string;
  fromEntity?: string;
  toEntity?: string;
  transferKind?: "supplier-to-customer" | "customer-to-customer";
  paidAmount?: number;
  outstandingAmount?: number;
  productId?: string;
  unitCost?: number;
  createdAt?: string;
  source?: "supplier" | "customer-trade-in" | "exchange";
  exchangeId?: string;
  tradeInCredit?: number;
  amountDue?: number;
  invoiceNumber?: string;
  capitalId?: string;
  fundingSource?: "capital" | "supplier-credit" | "other";
};

export const categories = ["All categories", "Mobiles", "Smartwatches", "Audio", "Chargers", "Cables", "Tablets", "Accessories"];
export const formatCurrency = (value: number) => `Rs ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(value)}`;
export const formatCompactCurrency = (value: number) => {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (absolute >= 1_000_000) return `Rs ${sign}${Math.round(absolute / 1_000_000)}M`;
  if (absolute >= 1_000) return `Rs ${sign}${Math.round(absolute / 1_000)}K`;
  return formatCurrency(value);
};

export function getMonthOptions(records: Transaction[]) {
  const recordedMonths = Array.from(new Set(records.map((record) => record.month).filter(Boolean)));
  const years = Array.from(new Set(recordedMonths.map((value) => value.match(/^(\d{4})-\d{2}$/)?.[1]).filter((value): value is string => Boolean(value))));
  const months = Array.from(new Set([
    ...recordedMonths,
    ...years.flatMap((year) => Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`)),
  ])).sort((a, b) => b.localeCompare(a));
  return [{ value: "all", label: "All months" }, ...months.map((value) => ({ value, label: new Intl.DateTimeFormat("en-PK", { month: "long", year: "numeric" }).format(new Date(`${value}-01T00:00:00`)) }))];
}

export function getTransactionItems(transaction: Transaction): SaleLineItem[] {
  return transaction.items ?? [];
}

export function formatTransactionTime(transaction: Transaction) {
  if (!transaction.createdAt) return transaction.time;
  const createdAt = new Date(transaction.createdAt);
  const elapsed = Math.max(0, Date.now() - createdAt.getTime());
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const clock = new Intl.DateTimeFormat("en-PK", { hour: "numeric", minute: "2-digit", hour12: true }).format(createdAt);
  const current = new Date();
  const sameDay = current.getFullYear() === createdAt.getFullYear() && current.getMonth() === createdAt.getMonth() && current.getDate() === createdAt.getDate();
  if (sameDay) return clock;
  const date = new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric" }).format(createdAt);
  return `${date}, ${clock}`;
}

export function formatLongDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

export function getCapitalSummary(capitalId: string, entries: CapitalEntry[], transactions: Transaction[], supplierPayments: SupplierPayment[], expenses: Expense[]) {
  const contributed = entries.filter((entry) => entry.capitalId === capitalId && entry.type === "contribution").reduce((sum, entry) => sum + entry.amount, 0);
  const withdrawn = entries.filter((entry) => entry.capitalId === capitalId && entry.type === "withdrawal").reduce((sum, entry) => sum + entry.amount, 0);
  const purchases = transactions.filter((transaction) => transaction.type === "purchase" && transaction.capitalId === capitalId).reduce((sum, transaction) => sum + (transaction.paidAmount ?? 0), 0);
  // The initial payment recorded with a purchase is represented both on the
  // purchase and in the supplier-payment ledger. Count it once here.
  const payments = supplierPayments.filter((payment) => payment.capitalId === capitalId && payment.note !== "Paid with purchase").reduce((sum, payment) => sum + payment.amount, 0);
  const expenseTotal = expenses.filter((expense) => expense.capitalId === capitalId).reduce((sum, expense) => sum + expense.amount, 0);
  const used = purchases + payments + expenseTotal;
  return { contributed, withdrawn, used, available: contributed - withdrawn - used };
}

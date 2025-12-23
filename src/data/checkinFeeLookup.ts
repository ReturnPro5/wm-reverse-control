// Check-In Fee Lookup Table
// Generated from checkin-2.csv
// Key format: {Category}{Program} → Price

const CHECKIN_FEE_MAP: Record<string, number> = {
  "AdultBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Automotive -> Automotive AccessoriesBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Automotive -> Automotive PartsBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Automotive -> Automotive Tools -> HandBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Automotive -> Automotive Tools -> PowerBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Automotive -> TiresBENAR-WM-RECLAIMS-OVERSTOCK": 5.00,
  "Baby -> Baby Food & FormulaBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Baby -> Baby MonitorsBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Baby -> Bedding & DecorBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Baby -> Car SeatsBENAR-WM-RECLAIMS-OVERSTOCK": 5.00,
  "Baby -> Diapers & WipesBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Baby -> Health & SafetyBENAR-WM-RECLAIMS-OVERSTOCK": 5.00,
  "Baby -> Nursing & Feeding SuppliesBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Baby -> StrollersBENAR-WM-RECLAIMS-OVERSTOCK": 5.00,
  "Baby -> Walkers, Swings & BouncersBENAR-WM-RECLAIMS-OVERSTOCK": 5.00,
  "BooksBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Clothing, Shoes & Accessories -> Backpacks, Bags, Wallets & AccessoriesBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Clothing, Shoes & Accessories -> Clothing -> BabiesBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Clothing, Shoes & Accessories -> Clothing -> BoysBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Clothing, Shoes & Accessories -> Clothing -> GirlsBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Clothing, Shoes & Accessories -> Clothing -> Mens -> Dress ShirtsBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Clothing, Shoes & Accessories -> Clothing -> Mens -> Jackets & OuterwearBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Clothing, Shoes & Accessories -> Clothing -> Mens -> Jeans, Pants & ShortsBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Clothing, Shoes & Accessories -> Clothing -> Mens -> Sleepwear & RobesBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Clothing, Shoes & Accessories -> Clothing -> Mens -> Suits & SportcoatsBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Clothing, Shoes & Accessories -> Clothing -> Mens -> SwimwearBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Clothing, Shoes & Accessories -> Clothing -> Mens -> T-Shirts, Polos, SweatersBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Clothing, Shoes & Accessories -> Clothing -> Mens -> Underwear & SocksBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Clothing, Shoes & Accessories -> Clothing -> Womens -> Dresses & SkirtsBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Clothing, Shoes & Accessories -> Clothing -> Womens -> Jackets & OuterwearBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Clothing, Shoes & Accessories -> Clothing -> Womens -> Jeans, Pants, Legging & ShortsBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Clothing, Shoes & Accessories -> Clothing -> Womens -> Shirts & BlousesBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Clothing, Shoes & Accessories -> Clothing -> Womens -> SwimwearBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Clothing, Shoes & Accessories -> Clothing -> Womens -> T-Shirts, Polos, Sweaters & CardigansBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Clothing, Shoes & Accessories -> Clothing -> Womens -> Underwear, Intimates, Sleepwear & SocksBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Clothing, Shoes & Accessories -> Shoes -> BabiesBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Clothing, Shoes & Accessories -> Shoes -> BoysBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Clothing, Shoes & Accessories -> Shoes -> GirlsBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Clothing, Shoes & Accessories -> Shoes -> MensBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Clothing, Shoes & Accessories -> Shoes -> WomensBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Custom Order ItemsBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> BatteriesBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Cameras -> AccessoriesBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Cameras -> Camcorders -> Action CamcordersBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Cameras -> Camcorders -> Digital CamcordersBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Cameras -> DSLRBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Cameras -> LensesBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Cameras -> Point & ShootBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Car Audio, Video & Electronics -> AccessoriesBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Car Audio, Video & Electronics -> AlarmsBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Car Audio, Video & Electronics -> AmplifiersBENAR-WM-RECLAIMS-OVERSTOCK": 5.00,
  "Electronics -> Car Audio, Video & Electronics -> Back up & Dashboard CamerasBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Car Audio, Video & Electronics -> CB RadiosBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Car Audio, Video & Electronics -> HandsfreeBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Car Audio, Video & Electronics -> SpeakersBENAR-WM-RECLAIMS-OVERSTOCK": 5.00,
  "Electronics -> Car Audio, Video & Electronics -> StereosBENAR-WM-RECLAIMS-OVERSTOCK": 5.00,
  "Electronics -> Car Audio, Video & Electronics -> VideoBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Cellular Phones -> Accessories -> CasesBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Cellular Phones -> Accessories -> OtherBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Cellular Phones -> Basic Mobile Phones (Non-Smart) -> PostpaidBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Cellular Phones -> Basic Mobile Phones (Non-Smart) -> PrepaidBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Cellular Phones -> Mobile HotspotBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Cellular Phones -> Smart Phones -> Apple iPhonesBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Cellular Phones -> Smart Phones -> LGBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Cellular Phones -> Smart Phones -> OtherBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Cellular Phones -> Smart Phones -> SamsungBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Computers -> Accessories -> DocksBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Computers -> Accessories -> Keyboards & MiceBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Computers -> Accessories -> OtherBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Computers -> Accessories -> Pen / Stylus -> Non-PoweredBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Computers -> Accessories -> Pen / Stylus -> PoweredBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Computers -> Accessories -> Power Adapters & ChargersBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Computers -> All In One ComputersBENAR-WM-RECLAIMS-OVERSTOCK": 5.00,
  "Electronics -> Computers -> Computer Components -> Cooling ComponentsBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Computers -> Computer Components -> CPU/ProcessorsBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Computers -> Computer Components -> Frame PiecesBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Computers -> Computer Components -> GPU/Graphics CardsBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Computers -> Computer Components -> Integrated CamerasBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Computers -> Computer Components -> Integrated Keyboards/TrackpadsBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Computers -> Computer Components -> Internal/External BatteriesBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Computers -> Computer Components -> Internal/External StorageBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Computers -> Computer Components -> Miscellaneous ComponentsBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Computers -> Computer Components -> MotherboardsBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Computers -> Computer Components -> Network AdaptersBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Computers -> Computer Components -> Optical DrivesBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Computers -> Computer Components -> PSU/Power SuppliesBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Computers -> Computer Components -> RAM/MemoryBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Computers -> Computer Components -> Screens/DigitizersBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Computers -> Computer Components -> Tower/CasesBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Computers -> Computer Software -> GamesBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Computers -> Computer Software -> SoftwareBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Computers -> DesktopsBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Computers -> FlashDrives/SD/Storage MediaBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Computers -> LaptopsBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Computers -> MonitorsBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Computers -> NetworkingBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Digital Picture FramesBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Drones & Quadcopters -> AccessoriesBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Drones & Quadcopters -> Drones & Quadcopters VehiclesBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> GPS & Navigation -> GPS AccessoriesBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> GPS & Navigation -> GPS UnitBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Headphones & Portable Speakers -> AccessoriesBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Headphones & Portable Speakers -> In Ear HeadphonesBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Headphones & Portable Speakers -> Over Ear HeadphonesBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Headphones & Portable Speakers -> Portable SpeakersBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Home Audio & Theater -> AccessoriesBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Electronics -> Home Audio & Theater -> Clock RadioBENAR-WM-RECLAIMS-OVERSTOCK": 2.50,
  // FORTX entries
  "AdultFORTX-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Automotive -> Automotive AccessoriesFORTX-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Automotive -> Automotive PartsFORTX-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Automotive -> Automotive Tools -> HandFORTX-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Automotive -> Automotive Tools -> PowerFORTX-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Automotive -> TiresFORTX-WM-RECLAIMS-OVERSTOCK": 5.00,
  "Baby -> Baby Food & FormulaFORTX-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Baby -> Baby MonitorsFORTX-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Baby -> Bedding & DecorFORTX-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Baby -> Car SeatsFORTX-WM-RECLAIMS-OVERSTOCK": 5.00,
  "Baby -> Diapers & WipesFORTX-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Baby -> Health & SafetyFORTX-WM-RECLAIMS-OVERSTOCK": 5.00,
  "Baby -> Nursing & Feeding SuppliesFORTX-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Baby -> StrollersFORTX-WM-RECLAIMS-OVERSTOCK": 5.00,
  "Baby -> Walkers, Swings & BouncersFORTX-WM-RECLAIMS-OVERSTOCK": 5.00,
  "BooksFORTX-WM-RECLAIMS-OVERSTOCK": 2.50,
  // FRAKY entries
  "AdultFRAKY-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Automotive -> Automotive AccessoriesFRAKY-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Automotive -> Automotive PartsFRAKY-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Automotive -> Automotive Tools -> HandFRAKY-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Automotive -> Automotive Tools -> PowerFRAKY-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Automotive -> TiresFRAKY-WM-RECLAIMS-OVERSTOCK": 5.00,
  "Baby -> Baby Food & FormulaFRAKY-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Baby -> Baby MonitorsFRAKY-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Baby -> Bedding & DecorFRAKY-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Baby -> Car SeatsFRAKY-WM-RECLAIMS-OVERSTOCK": 5.00,
  "Baby -> Diapers & WipesFRAKY-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Baby -> Health & SafetyFRAKY-WM-RECLAIMS-OVERSTOCK": 5.00,
  "Baby -> Nursing & Feeding SuppliesFRAKY-WM-RECLAIMS-OVERSTOCK": 2.50,
  "Baby -> StrollersFRAKY-WM-RECLAIMS-OVERSTOCK": 5.00,
  "Baby -> Walkers, Swings & BouncersFRAKY-WM-RECLAIMS-OVERSTOCK": 5.00,
  "BooksFRAKY-WM-RECLAIMS-OVERSTOCK": 2.50,
};

// Load the full lookup from CSV at runtime
let fullLookupMap: Record<string, number> | null = null;

/**
 * Parse the full CSV and build the lookup map
 * This runs once on first use
 */
const loadFullLookup = (): Record<string, number> => {
  if (fullLookupMap) return fullLookupMap;
  
  // Start with the hardcoded subset
  fullLookupMap = { ...CHECKIN_FEE_MAP };
  
  // Note: The full CSV has ~1060 rows. For complete coverage,
  // import and parse the CSV dynamically or expand this map.
  // For now, we use the hardcoded subset plus dynamic loading.
  
  return fullLookupMap;
};

/**
 * Load the full lookup from CSV content
 */
export const loadCheckinFeesFromCSV = (csvContent: string): void => {
  const lines = csvContent.split('\n');
  if (lines.length < 2) return;
  
  fullLookupMap = {};
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse CSV line respecting quotes
    const values: string[] = [];
    let inQuote = false;
    let currentValue = '';
    
    for (const char of line) {
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === ',' && !inQuote) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim());
    
    // Format: Category, Program, BasePriceType, Key, Price
    if (values.length >= 5) {
      const key = values[3]; // The Key column already has the format we need
      const priceStr = values[4].replace(/[$,]/g, '');
      const price = parseFloat(priceStr);
      
      if (key && !isNaN(price)) {
        fullLookupMap[key] = price;
      }
    }
  }
};

/**
 * Get check-in fee from lookup table
 * @param category - Category name
 * @param program - Program name
 * @returns Fee amount or 0 if not found
 */
export const getCheckInFeeFromLookup = (
  category: string | null | undefined, 
  program: string | null | undefined
): number => {
  if (!category || !program) return 0;
  
  const lookup = loadFullLookup();
  const key = `${category}${program}`;
  
  return lookup[key] || 0;
};

/**
 * Check if a category/program combination exists in the lookup
 */
export const hasCheckInFeeLookup = (
  category: string | null | undefined, 
  program: string | null | undefined
): boolean => {
  if (!category || !program) return false;
  
  const lookup = loadFullLookup();
  const key = `${category}${program}`;
  
  return key in lookup;
};
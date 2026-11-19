import React, { useEffect, useRef, useState } from 'react';
import { LogOut, Volume2, VolumeX, Pause, Music, Zap, Sparkles, Shield, Flame, Crosshair } from 'lucide-react';
import { MenuMusicEngine } from '../audio/menuMusic';
import { BattleSfxEngine } from '../audio/battleSfx';
import { auth, db } from '../lib/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  signOut
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  increment, 
  serverTimestamp,
  collection,
  addDoc
} from 'firebase/firestore';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Types
type GameState = 'START' | 'DIALOGUE' | 'PLAYING' | 'GAME_OVER' | 'VICTORY' | 'VIDEO_CINEMATIC';

interface Modifiers {
  saladOnly: boolean;
  storm: boolean;
  superEasy: boolean;
  gunMode: boolean;
  bWinger: boolean;
  bigMode: boolean;
  randomChaos: boolean;
  mobile: boolean;
  hardMode: boolean;
  enhancedMap: boolean;
  accurateMode: boolean;
  monkCartmanMode: boolean;
  nutritionBalanceMode: boolean;
  godMode: boolean;
  aiMode: boolean;
  dimensionTear: boolean;
  blackHoleCore: boolean;
  classicMode: boolean;
  mode3D: boolean;
  gorgotastic: boolean;
  breakingPoint: boolean;
  blindnessMode: boolean;
}

interface Wall extends Entity {
  color: string;
}

interface Entity {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Player extends Entity {
  speed: number;
  health: number;
  maxHealth: number;
  isHit: number;
  attackTimer: number;
  vx?: number;
  vy?: number;
  stunTimer: number;
}

interface Boss extends Entity {
  health: number;
  maxHealth: number;
  regenRate: number;
  speed: number;
  direction: number;
  isHit: number;
  attackTimer: number;
  corruption: number; // 0 to 10000
  state:
    | 'NORMAL'
    | 'SLAMMING'
    | 'RISING'
    | 'SUMMONING_DONGFISH'
    | 'OREO_SANDWICH'
    | 'CHEF_SPIN'
    | 'OATMEAL_WALL'
    | 'ULTIMATE_SPAM'
    | 'CHERRY_CHARGE'
    | 'DIZZY'
    | 'RAGE'
    | 'WHEELCHAIR'
    | 'SMASH_2'
    | 'SODA_BLAST'
    | 'EARTHQUAKE_CRACK'
    | 'ENTRANCE_CHICKEN'
    | 'SUMMON_GUY'
    | 'MINIGUN_BARRAGE'
    | 'CALORIE_SPIRAL'
    | 'JUNK_METEOR_SHOWER'
    | 'GREASE_SUPERNOVA'
    | 'CALORIE_BLACK_HOLE';
  slamTimer: number;
  stepTimer?: number;
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  emoji: string;
  isPlayer: boolean;
  isHealthy: boolean;
  isDongfish?: boolean;
  isSummonGuy?: boolean;
  isOreo?: boolean;
  isBandAid?: boolean;
  isChef?: boolean;
  isOatmeal?: boolean;
  isSodaBlast?: boolean;
  isMonkBullet?: boolean;
  isWhitePellet?: boolean;
  isBigMac?: boolean;
  isCherryCoke?: boolean;
  isCreamPepsi?: boolean;
  isMinigun?: boolean;
  homingTimer?: number;
  life?: number;
  rotation: number;
  rotationSpeed: number;
  lastTeleport?: number;
  trail?: { x: number; y: number }[];
}

interface GroundMark {
  x: number;
  y: number;
  radius: number;
  type: 'CRATER' | 'FISSURE' | 'SCORCH';
  angle: number;
  life: number;
  maxLife: number;
  color: string;
}

interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

interface SlashArc {
  x: number;
  y: number;
  angle: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  speed: number;
  color: string;
  width: number;
}

interface OrbitingBigMac {
  id: number;
  angle: number;
  orbitRadius: number;
  orbitSpeed: number;
  state: 'ORBITING' | 'TARGETING' | 'THROWN';
  throwTimer: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  width: number;
  height: number;
  damage: number;
}

interface BattleHudState {
  bossHealth: number;
  bossMaxHealth: number;
  bossTrailHealth: number;
  bossRegen: number;
  bossCorruption: number;
  bossPhase: number;
  bossState: Boss['state'];
  playerHealth: number;
  playerMaxHealth: number;
  playerTrailHealth: number;
  combo: number;
  dashCd: number;
  dashMaxCd: number;
  pulseCd: number;
  pulseMaxCd: number;
  deflectedCount: number;
  isInvuln: boolean;
  balanceLevel: number;
}

interface EntranceCutscene {
  active: boolean;
  timer: number;
  duration: number;
  clouds: { x: number; y: number; rx: number; ry: number; speed: number; alpha: number; layer: number }[];
  windStreaks: { x: number; y: number; len: number; speed: number; alpha: number }[];
  greaseSparks: { x: number; y: number; vx: number; vy: number; size: number; color: string }[];
  impactFired: boolean;
}

interface Phase2Cutscene {
  active: boolean;
  timer: number;
  duration: number;
  barHeight: number;
  phase: 'COLLAPSE' | 'AWAKENING' | 'EXPLOSION' | 'ASCENDED';
  stars: { x: number; y: number; size: number; twinkle: number }[];
  embers: { x: number; y: number; vx: number; vy: number; size: number; color: string }[];
  rings: { radius: number; maxRadius: number; speed: number; color: string; width: number }[];
  cuesFired: { [key: string]: boolean };
}

interface Phase3Cutscene {
  active: boolean;
  timer: number;
  duration: number;
  barHeight: number;
  phase: 'SHATTER' | 'ABSORBING' | 'DETONATION' | 'UNLEASHED';
  stars: { x: number; y: number; size: number; twinkle: number }[];
  swirlingFoods: {
    angle: number;
    dist: number;
    speed: number;
    pullSpeed: number;
    size: number;
    foodIdx: number;
    rot: number;
    color: string;
  }[];
  rings: { radius: number; maxRadius: number; speed: number; color: string; width: number }[];
  cuesFired: { [key: string]: boolean };
}

interface DeathCutscene {
  active: boolean;
  timer: number;
  duration: number;
  stars: { x: number; y: number; size: number; twinkle: number; speed: number; color: string }[];
  monoliths: { x: number; y: number; w: number; h: number; fallSpeed: number; tilt: number; rotSpeed: number; depth: number; color: string }[];
  cracks: { angle: number; segments: { dx: number; dy: number }[]; width: number; delay: number }[];
  bossShards: {
    x: number; y: number; vx: number; vy: number;
    size: number; rot: number; vRot: number;
    color: string; delay: number; emoji?: string;
  }[];
  ribbons: { angleOffset: number; speed: number; radiusScale: number; color: string; emoji: string }[];
  rings: { radius: number; maxRadius: number; speed: number; color: string; width: number }[];
  cuesFired: { [key: string]: boolean };
}

interface Helicopter extends Entity {
  active: boolean;
  hasPlayer: boolean;
  targetX: number;
  targetY: number;
  speed: number;
  rotation: number;
  lastShot?: number;
  phase?: 'APPROACH' | 'PICKUP' | 'BOMBING_RUN' | 'ESCAPE' | 'CRASHING' | 'FINISHED' | 'COMBAT';
  cutsceneTimer?: number;
  ladderLength?: number;
  vx?: number;
  vy?: number;
  isAmbushed?: boolean;
  crashTimer?: number;
}

const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 4000;

const HEALTHY_FOODS = ['🍎', '🥦', '🥕', '🍌', '🍇'];
const JUNK_FOODS = ['🍔', '🍟', '🥤', '🍕', '🍩', '🌭'];

const bossImage = new Image();
bossImage.src = 'https://i.postimg.cc/XqxnHNsK/htrwrwyhtytretryeqgyretgryettrewy.png';

const bossPhase2Image = new Image();
bossPhase2Image.src = 'https://i.postimg.cc/43t4xqsG/Screenshot-2026-11-01-162559.png';

const bossPhase3Image = new Image();
bossPhase3Image.src = 'https://i.postimg.cc/3r6Zhyrh/image.png';

const breakingPointImage = new Image();
breakingPointImage.src = 'https://i.postimg.cc/brN0HQw6/Breaking-Point.png';

const bigMacImage = new Image();
bigMacImage.src = 'https://s7d1.scene7.com/is/image/mcdonalds/DC_202302_0005-999_BigMac_1564x1564-1:product-header-mobile?wid=1313&hei=1313&dpr=off';

const healthyFoodImage = new Image();
healthyFoodImage.src = 'https://hellolittlehome.com/wp-content/uploads/2022/08/garden-salad-recipe-2.jpg';

const junkFoodImage = new Image();
junkFoodImage.src = 'https://thesuburbansoapbox.com/wp-content/uploads/2022/10/Rotisserie-Chicken.jpg';

const dongfishImage = new Image();
dongfishImage.src = 'https://mediaproxy.snopes.com/width/1200/https://media.snopes.com/2021/01/Featured-Image-Templates-1.png';

const summonGuyImage = new Image();
summonGuyImage.src = 'https://i.postimg.cc/90ths8sJ/unnamed.png';

const oreoImage = new Image();
oreoImage.src = 'https://images.ctfassets.net/kvfvpz4abpco/7n3VlWuCUPBuMVzlmo9Pwe/bc74da99bbbed46fc896cb5166fc81d1/oreo-footer.png?w=1920';

const chefImage = new Image();
chefImage.src = 'https://cdn11.bigcommerce.com/s-t8bvbs505h/images/stencil/500x659/products/15314623/16362193/513BO5cqdSL__33344.1615502946.jpg?c=2';

const oatmealImage = new Image();
oatmealImage.src = 'https://www.kroger.com/product/images/large/front/0002430083561';

const cartmanImage = new Image();
cartmanImage.src = 'https://i.postimg.cc/HWMQKx8t/gergergregerg.png';

const helicopterImage = new Image();
helicopterImage.src = 'https://www.pngmart.com/files/6/Helicopter-PNG-Free-Download.png';

const wheelchairImage = new Image();
wheelchairImage.src = 'https://m.media-amazon.com/images/I/81VqcLRJgXL._AC_.jpg';

const cherryCokeImage = new Image();
cherryCokeImage.src = 'https://dankmart.ca/cdn/shop/files/Coca-Cola-Cherry-Float.jpg?v=1769787380&width=1000';

const creamPepsiImage = new Image();
creamPepsiImage.src = 'https://i5.walmartimages.com/seo/Pepsi-Cola-Soda-Pop-Wild-Cherry-Cream-12-Fl-Oz-Cans-12-Pack-Packaging-May-Vary_cba0fc84-6391-4368-99d4-5886fe783d4b.186cd89a235e18f10ed883fbde560330.jpeg';

const moonImage = new Image();
moonImage.src = 'https://images.unsplash.com/photo-1532693322450-2cb5c511067d?q=80&w=2070&auto=format&fit=crop';

const blackHoleImage = new Image();
blackHoleImage.src = 'https://facts.net/wp-content/uploads/2024/10/39-facts-about-black-holes-1729698267.jpg';

const dimensionTearImage = new Image();
dimensionTearImage.src = 'https://s.yimg.com/ny/api/res/1.2/3FUfItmzFYEMujEETv_BcQ--/YXBwaWQ9aGlnaGxhbmRlcjt3PTEyMDA7aD02NzU-/https://media.zenfs.com/en/gamesradar_237/90f2bd28a3b3d2b399b9bc116a201c04';

const BACKSTORY_DIALOGUE = [
  "So... you've finally arrived at the heart of the Junk Food Realm.",
  "I am Gorgotolisis. Born from the grease of a thousand deep fryers and the sugar of a million sodas.",
  "For eons, I have watched your kind choose the easy path. The tasty path. The path of least resistance.",
  "But now, you stand before me, clutching your... salads. How quaint.",
  "Now, mortal. I offer you a choice. A simple one, really."
];

const LIVE_PATH_DIALOGUE = [
  "Hmph. You choose to live? You choose the hard way.",
  "Very well. I shall show you why they call me the Junk Food Demon.",
  "Prepare to be overwhelmed by the flavor of your own destruction!"
];

const CARTMAN_DIALOGUE = [
  "HEY! YOU! GET IN THE CHOPPER!",
  "Gorgotolisis is reaching critical mass! 1000% I-Ready Test is no joke!",
  "I'm Monk Cartman, and I'm here to save your healthy hide.",
  "Don't just stand there with that salad, let's move!"
];

const CINEMATIC_TWIST_DIALOGUE = [
  "WAIT! You think this is my true form?",
  "The grease... it's evolving! It's becoming... SELF-AWARE!",
  "BEHOLD! THE ULTIMATE CALORIE OVERLOAD! YOU SHALL DROWN IN GRAVY!"
];

const SALAD_DISGUSTING_DIALOGUE = [
  "Gorgotolisis: UGH! THIS SALAD! IT'S... IT'S DISGUSTING!",
  "I CAN FEEL THE VITAMINS BURNING THROUGH MY GREASE! IT'S REVOLTING!",
  "STOP THROWING THAT NUTRITIOUS FILTH AT ME!",
  "Monk Cartman: HE'S WEAKENING! I'M COMING IN TO HELP!",
  "LET'S SHOW THIS CALORIE KING WHAT REAL STRENGTH LOOKS LIKE!"
];

const MONK_BOSS_DIALOGUE = [
  "Monk Cartman: RESPECT MY AUTHORITY... AND MY AIR SUPERIORITY!",
  "Your salads can't reach me up here in my tactical helicopter!",
  "I have been training in the mountains of tranquility AND pilot school!",
  "Prepare to face the true power of discipline... FROM THE SKY!"
];

const MODIFIER_DEFS = [
  { id: 'saladOnly', name: 'Salad Storm', image: 'https://hellolittlehome.com/wp-content/uploads/2022/08/garden-salad-recipe-2.jpg', desc: 'Mostly healthy projectiles' },
  { id: 'storm', name: 'The Border', image: 'https://progameguides.com/wp-content/uploads/2018/12/fortnite-loading-screen-storm-king.jpg', desc: 'Storm border closes in' },
  { id: 'superEasy', name: 'Easy Mode', image: 'https://cdn.thecelebritist.com/735418da3259d9f0a71c2972ca6d88dab383cea1c557b129ab6f6142b3affd5c.jpg', desc: 'Higher player health' },
  { id: 'gunMode', name: 'Gun Mode', image: 'https://techiesportsdadreviews.com/wp-content/uploads/2024/07/water-guns-for-kids-6-pack-squirt-guns-water-soaker-blaster-220cc-capacity-15-20-feet-shooting-range-water-gun-for-boys-1-3.jpg', desc: 'Shoot back with SPACE' },
  { id: 'bWinger', name: 'B-Winger', image: 'https://m.media-amazon.com/images/I/81VqcLRJgXL._AC_.jpg', desc: 'Dizzy boss & accuracy penalty' },
  { id: 'bigMode', name: 'Big Mode', image: 'https://www.ixpap.com/images/2024/12/CaseOh-Wallpaper-3.jpeg', desc: 'Huge boss & earthquake steps' },
  { id: 'randomChaos', name: 'Chaos Mode', image: 'https://images-na.ssl-images-amazon.com/images/I/71TAbWwHV7L._AC_SL1500_.jpg', desc: 'Random round modifiers' },
  { id: 'mobile', name: 'Mobile View', image: 'https://s3b.cashify.in/gpro/uploads/2022/09/06141907/The-Latest-Xiaomi-Smartphones.jpg', desc: 'On-screen d-pad' },
  { id: 'hardMode', name: 'INSANE Mode', image: 'https://c.pxhere.com/photos/aa/f5/grave_stones_forest_cemetery_stuttgart_cemetery_woodland_cemetery_graves_soldiers_graves_resting_place_last_calm-891459.jpg!d', desc: 'Dodge, Stun, Cracks, NO MERCY' },
  { id: 'enhancedMap', name: 'Enhanced Map', image: 'https://cf-images.us-east-1.prod.boltdns.net/v1/static/77374810001/bcd159b7-f6e0-4d81-ae99-529bb732c6a5/d45c9715-7f4c-4593-8da4-b25a97100783/1280x720/match/image.jpg', desc: 'Dynamic walls and cover' },
  { id: 'accurateMode', name: 'Accurate Mode', image: 'https://i.pinimg.com/736x/70/43/dd/7043dd8748922271e7567e9d9e38a0ca.jpg', desc: 'Slow boss, 75% I-Ready cap, salad rage' },
  { id: 'monkCartmanMode', name: 'Monk Cartman Boss', image: 'https://i.postimg.cc/HWMQKx8t/gergergregerg.png', desc: 'Fight the Monk instead of the Demon' },
  { id: 'nutritionBalanceMode', name: 'Nutrition Balance', image: 'https://img.freepik.com/premium-vector/healthy-balanced-diet-plate-featuring-fresh-organic-vegetables-fruits-protein-grains-nuts-see_597121-40054.jpg?w=2000', desc: 'Maintain the balance between healthy and junk' },
  { id: 'godMode', name: 'God Mode', image: 'https://i.pinimg.com/736x/c8/1d/c3/c81dc3dd44d0791292bef70634f33965.jpg', desc: 'Invincibility: You cannot take damage' },
  { id: 'aiMode', name: 'AI Director', image: 'https://4kwallpapers.com/images/walls/thumbs_3t/18721.png', desc: 'Gemini controls the boss dynamically!' },
  { id: 'blackHoleCore', name: 'Black Hole Core', image: 'https://facts.net/wp-content/uploads/2024/10/39-facts-about-black-holes-1729698267.jpg', desc: 'Center of screen pulls EVERYTHING in' },
  { id: 'dimensionTear', name: 'Dimension Tear', image: 'https://s.yimg.com/ny/api/res/1.2/3FUfItmzFYEMujEETv_BcQ--/YXBwaWQ9aGlnaGxhbmRlcjt3PTEyMDA7aD02NzU-/https://media.zenfs.com/en/gamesradar_237/90f2bd28a3b3d2b399b9bc116a201c04', desc: 'Dimension tears teleport food' },
  { id: 'classicMode', name: 'Classic Mode', image: 'https://i.imgflip.com/2/84ulrr.jpg', desc: 'Original experience: Boss Phases, Runner skin only, No soda attacks' },
  { id: 'mode3D', name: '3D Mode', image: 'https://upload.wikimedia.org/wikipedia/commons/a/ae/Bicolor_cubic_honeycomb.png?utm_source=simple.wikipedia.org&utm_campaign=index&utm_content=original', desc: '3rd-person 3D perspective with 2D billboards & depth!' },
  { id: 'gorgotastic', name: 'Gorgotastic', image: 'https://i.postimg.cc/XqxnHNsK/htrwrwyhtytretryeqgyretgryettrewy.png', desc: '100x harder, NO HELICOPTER, Boss spawns clones!' },
  { id: 'breakingPoint', name: 'Breaking Point', image: 'https://i.postimg.cc/brN0HQw6/Breaking-Point.png', desc: 'Gorgotolisis snaps! Only fires glowing white pellets & sneezing!' },
  { id: 'blindnessMode', name: 'Blindness Mode', image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1000&auto=format&fit=crop', desc: 'Total darkness except for a spotlight around your character' },
] as const;

const SHOP_SKINS = [
  { id: '🏃', type: 'emoji', value: '🏃', name: 'Runner', price: 0 },
  { id: '🥗', type: 'image', value: 'https://hellolittlehome.com/wp-content/uploads/2022/08/garden-salad-recipe-2.jpg', name: 'Salad', price: 25 },
  { id: '🍪', type: 'image', value: 'https://images.ctfassets.net/kvfvpz4abpco/7n3VlWuCUPBuMVzlmo9Pwe/bc74da99bbbed46fc896cb5166fc81d1/oreo-footer.png?w=1920', name: 'Oreo', price: 25 },
  { id: '🍗', type: 'image', value: 'https://www.spendwithpennies.com/wp-content/uploads/2020/05/1200-Rotisserie-Chicken-SpendWithPennies-11.jpg', name: 'Chicken', price: 25 },
  { id: 'monk_cartman', type: 'image', value: 'https://i.postimg.cc/HWMQKx8t/gergergregerg.png', name: 'Monk Cartman', price: 50 },
  { id: 'b_winger', type: 'image', value: 'https://m.media-amazon.com/images/I/81VqcLRJgXL._AC_.jpg', name: 'B Winger', price: 150 },
  { id: 'money', type: 'image', value: 'https://media.istockphoto.com/id/135194728/photo/rolling-in-the-money.jpg?s=1024x1024&w=is&k=20&c=Q7-e8Tcu5CV8nUZgAY5BloFUddWqPVvm1kO5hwGzfTA=', name: 'Money', price: 200 },
  { id: 'vip_crown', type: 'emoji', value: '👑', name: 'VIP Crown', price: 9999 },
] as const;

const skinImages: Record<string, HTMLImageElement> = {};
SHOP_SKINS.forEach(skin => {
  if (skin.type === 'image') {
    const img = new Image();
    img.src = skin.value;
    skinImages[skin.id] = img;
  }
});


export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLVideoElement>(null);
  const videoCutsceneRef = useRef<HTMLVideoElement>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [modifiers, setModifiers] = useState<Modifiers>({
    saladOnly: false,
    storm: false,
    superEasy: false,
    gunMode: false,
    bWinger: false,
    bigMode: false,
    randomChaos: false,
    mobile: false,
    hardMode: false,
    enhancedMap: false,
    accurateMode: false,
    monkCartmanMode: false,
    nutritionBalanceMode: false,
    godMode: false,
    aiMode: false,
    blackHoleCore: false,
    dimensionTear: false,
    classicMode: false,
    mode3D: false,
    gorgotastic: false,
    breakingPoint: false,
    blindnessMode: false,
  });
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [adminCorruption, setAdminCorruption] = useState(0);
  const [isGodModeActive, setIsGodModeActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [showVipModal, setShowVipModal] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [dialogueMode, setDialogueMode] = useState<'BACKSTORY' | 'LIVE_PATH' | 'CARTMAN' | 'TWIST' | 'SALAD_DISGUSTING' | 'MONK_BOSS'>('BACKSTORY');
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [deathCause, setDeathCause] = useState<string | null>(null);
  const [isEntranceCutscene, setIsEntranceCutscene] = useState(false);
  const [isPhase2Cutscene, setIsPhase2Cutscene] = useState(false);
  const [isPhase3Cutscene, setIsPhase3Cutscene] = useState(false);
  const [isDeathCutscene, setIsDeathCutscene] = useState(false);
  const [deathCutsceneSec, setDeathCutsceneSec] = useState(0);
  const [menuMusicMuted, setMenuMusicMuted] = useState(false);
  const [menuMusicActive, setMenuMusicActive] = useState(false);
  const menuMusicRef = useRef<MenuMusicEngine | null>(null);
  const [sfxMuted, setSfxMuted] = useState(false);
  const [battleMusicMuted, setBattleMusicMuted] = useState(false);
  const battleSfxRef = useRef<BattleSfxEngine | null>(null);
  const [battleHud, setBattleHud] = useState<BattleHudState>({
    bossHealth: 5000,
    bossMaxHealth: 5000,
    bossTrailHealth: 5000,
    bossRegen: 15,
    bossCorruption: 0,
    bossPhase: 1,
    bossState: 'NORMAL',
    playerHealth: 100,
    playerMaxHealth: 100,
    playerTrailHealth: 100,
    combo: 0,
    dashCd: 0,
    dashMaxCd: 3,
    pulseCd: 0,
    pulseMaxCd: 7,
    deflectedCount: 0,
    isInvuln: false,
    balanceLevel: 0,
  });
  
  const isOnMoon = useRef(false);
  const dimensionsRef = useRef({ width: 800, height: 600 });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch/Create profile
        const userRef = doc(db, 'users', currentUser.uid);
        try {
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            setProfile(userSnap.data());
          } else {
            const newProfile = {
              uid: currentUser.uid,
              displayName: currentUser.displayName || 'Player',
              totalScore: 0,
              highScore: 0,
              bossDefeats: 0,
              coins: 0,
              unlockedModifiers: MODIFIER_DEFS.map(m => m.id),
              unlockedSkins: ['🏃'],
              selectedSkin: '🏃',
              createdAt: serverTimestamp(),
              lastActive: serverTimestamp()
            };
            await setDoc(userRef, newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
        }
      } else {
        setProfile(null);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const saveGameSession = async (result: 'VICTORY' | 'GAME_OVER', finalScore: number) => {
    if (!user) return;
    
    try {
      // 1. Log session
      await addDoc(collection(db, 'sessions'), {
        userId: user.uid,
        score: finalScore,
        result,
        activeModifiers: Object.entries(modifiers)
          .filter(([_, active]) => active)
          .map(([id]) => id),
        timestamp: serverTimestamp()
      });

      // 2. Update user profile
      const userRef = doc(db, 'users', user.uid);
      const isVictory = result === 'VICTORY';
      // VICTORY CALCULATION
      const baseCoins = Math.floor(finalScore / 10) + (isVictory ? 50 : 0);
      const vipMulti = profile?.isVip ? 2 : 1;
      const coinsEarned = Math.floor(baseCoins * vipMulti);
      
      const updates: any = {
        totalScore: increment(finalScore),
        coins: increment(coinsEarned),
        lastActive: serverTimestamp(),
        // Just in case existing users miss certain modifiers (forces all to be unlocked)
        unlockedModifiers: MODIFIER_DEFS.map(m => m.id)
      };

      if (finalScore > (profile?.highScore || 0)) {
        updates.highScore = finalScore;
      }
      if (isVictory) {
        updates.bossDefeats = increment(1);
      }

      await updateDoc(userRef, updates);
      
      // Refresh local profile
      const userSnap = await getDoc(userRef);
      setProfile(userSnap.data());
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  // Game state refs (mutable to avoid re-renders)
  const keys = useRef<{ [key: string]: boolean }>({});
  const mousePos = useRef({ x: 0, y: 0 });
  const isMouseDown = useRef(false);
  const lastShotTime = useRef(0);
  const godMode = useRef(false);
  const cheatBuffer = useRef('');
  const projectileSpeedMult = useRef(1);
  const isBossFrozen = useRef(false);
  const infiniteHealth = useRef(false);
  const isControllingBoss = useRef(false);
  const hasTriggeredCartman = useRef(false);
  const isRescueEnding = useRef(false);
  const deflectedSalads = useRef(0);
  const hasTriggeredSaladDialogue = useRef(false);
  const pinchTriggered = useRef(false);
  const balanceLevel = useRef(0); // -100 to 100 for Nutrition Balance Mode
  const stormRadius = useRef(WORLD_WIDTH / 1.5);
  const screenShake = useRef(0);
  const cameraZoom = useRef(1);
  const cameraAngle = useRef<number>(0); // 360-degree head rotation angle in 1st person 3D mode
  const cameraPitch = useRef<number>(0); // Vertical head tilt (pitch) in 1st person 3D mode
  const sneezeTimer = useRef<number>(0);
  const plotTwistTriggered = useRef(false);
  const cinematicTimer = useRef(0);
  const lastAITick = useRef(0);
  const aiDecision = useRef<Boss['state'] | ''>('');
  const chaosModifiers = useRef({
    lowGravity: false,
    doubleSpeed: false,
    invertedControls: false,
    giantBoss: false,
    tinyPlayer: false,
  });
  const [activeModifiers, setActiveModifiers] = useState<string[]>([]);
  const [menuTab, setMenuTab] = useState<'modifiers' | 'skins' | 'upgrades'>('modifiers');
  const currentSkin = useRef('🏃');
  const dimensionTears = useRef<{ x: number, y: number, radius: number, partnerIndex: number }[]>([]);
  
  const fightTimer = useRef(0);
  const battleAudioRef = useRef<HTMLAudioElement>(null);
  const pendingBossMusicSeekRef = useRef<number | null>(null);
  const [bossMusicStartAt22, setBossMusicStartAt22] = useState(false);

  // Combat Ability & VFX Refs
  const dashTimer = useRef(0);
  const dashCooldown = useRef(0);
  const dashDir = useRef({ x: 0, y: -1 });
  const dashInvuln = useRef(0);
  const pulseCooldown = useRef(0);
  const dashGhosts = useRef<{ x: number; y: number; life: number; maxLife: number; color: string }[]>([]);
  const parryFlash = useRef(0);
  const bossHitFlash = useRef(0);
  const comboCount = useRef(0);
  const comboTimer = useRef(0);
  const bossTrailHealth = useRef(5000);
  const playerTrailHealth = useRef(100);
  const lastHudSync = useRef(0);
  const prevBossState = useRef<Boss['state']>('NORMAL');
  const hitStopTimer = useRef(0);
  const impactFrame = useRef<{
    active: boolean;
    timer: number;
    duration: number;
    x: number;
    y: number;
    accent: string;
    seed: number;
    isScreenCoord?: boolean;
  }>({
    active: false,
    timer: 0,
    duration: 0.09,
    x: 0,
    y: 0,
    accent: '#fde047',
    seed: 1,
    isScreenCoord: false,
  });
  
  useEffect(() => {
    currentSkin.current = modifiers.classicMode ? '🏃' : (profile?.selectedSkin || '🏃');
  }, [profile?.selectedSkin, modifiers.classicMode]);
  
  const player = useRef<Player>({
    x: WORLD_WIDTH / 2,
    y: WORLD_HEIGHT / 2,
    width: 40,
    height: 40,
    speed: 350,
    health: 100,
    maxHealth: 100,
    isHit: 0,
    attackTimer: 0,
  });

  const boss = useRef<Boss>({
    x: WORLD_WIDTH / 2,
    y: WORLD_HEIGHT / 2 - 300,
    width: 140,
    height: 140,
    health: 1500,
    maxHealth: 1500,
    regenRate: 20, // Health per second
    speed: 120,
    direction: 1,
    isHit: 0,
    attackTimer: 0,
    phase: 1,
    state: 'NORMAL',
    slamTimer: 5,
  });

  const helicopter = useRef<Helicopter>({
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    active: false,
    hasPlayer: false,
    targetX: 0,
    targetY: 0,
    speed: 400,
    rotation: 0,
  });

  const projectiles = useRef<Projectile[]>([]);
  const particles = useRef<Particle[]>([]);
  const shockwaves = useRef<Shockwave[]>([]);
  const groundMarks = useRef<GroundMark[]>([]);
  const floatingTexts = useRef<FloatingText[]>([]);
  const slashArcs = useRef<SlashArc[]>([]);
  const walls = useRef<Wall[]>([]);
  
  const lastTime = useRef<number>(0);
  const requestRef = useRef<number>(0);
  const activeBossImage = useRef<HTMLImageElement>(bossImage);
  const entranceCutscene = useRef<EntranceCutscene>({
    active: false,
    timer: 0,
    duration: 22.0,
    clouds: [],
    windStreaks: [],
    greaseSparks: [],
    impactFired: false,
  });
  const phase2Cutscene = useRef<Phase2Cutscene>({
    active: false,
    timer: 0,
    duration: 15.0,
    barHeight: 0,
    phase: 'COLLAPSE',
    stars: [],
    embers: [],
    rings: [],
    cuesFired: {},
  });
  const phase3Cutscene = useRef<Phase3Cutscene>({
    active: false,
    timer: 0,
    duration: 16.0,
    barHeight: 0,
    phase: 'SHATTER',
    stars: [],
    swirlingFoods: [],
    rings: [],
    cuesFired: {},
  });
  const minigunAccumulator = useRef(0);
  const minigunFoodIndex = useRef(0);
  const minigunShotCount = useRef(0);
  const minigunAimAngle = useRef(Math.PI / 2);
  const phase3AttackDeck = useRef<Boss['state'][]>([]);
  const deathCutscene = useRef<DeathCutscene>({
    active: false,
    timer: 0,
    duration: 60.0,
    stars: [],
    monoliths: [],
    cracks: [],
    bossShards: [],
    ribbons: [],
    rings: [],
    cuesFired: {},
  });
  const cutsceneAudioCtxRef = useRef<AudioContext | null>(null);
  const orbitingBurgers = useRef<OrbitingBigMac[]>([]);
  const bigMacCooldown = useRef<number>(2.0);

  const initGame = async () => {
    if (modifiers.aiMode) {
      const cooldownMins = profile?.isVip ? 10 : 15;
      if (profile && profile.lastAIPlay && Date.now() - profile.lastAIPlay < cooldownMins * 60 * 1000) {
        alert(`AI Director Mode is cooling down! Playable every ${cooldownMins} minutes.`);
        return;
      }
      if (!user) {
        alert('You must be signed in to play AI Director Mode so we can track the cooldown.');
        return;
      }
      try {
        await updateDoc(doc(db, 'users', user.uid), { lastAIPlay: Date.now() });
        setProfile({...profile, lastAIPlay: Date.now()});
      } catch (e) {
        console.error("Failed to update AI cooldown", e);
      }
    }

    const isEasy = modifiers.superEasy;
    const isHard = modifiers.hardMode;
    
    // Calculate Upgrades
    const vipHealth = profile?.isVip ? 100 : 0;
    
    const startX = WORLD_WIDTH / 2;
    const startY = modifiers.blackHoleCore ? WORLD_HEIGHT / 2 + 600 : WORLD_HEIGHT / 2;

    player.current = { 
      ...player.current, 
      x: startX, 
      y: startY, 
      health: (isEasy ? 1000 : (isHard ? 75 : 100)) + vipHealth, 
      maxHealth: (isEasy ? 1000 : (isHard ? 75 : 100)) + vipHealth, 
      speed: 350,
      isHit: 0,
      attackTimer: 0,
      vx: 0,
      vy: 0,
      stunTimer: 0
    };
    
    const bossHp = isHard ? 10000 : 5000;
    fightTimer.current = 0;
    sneezeTimer.current = 0;
    activeBossImage.current = modifiers.breakingPoint ? breakingPointImage : (modifiers.monkCartmanMode ? helicopterImage : bossImage);
    boss.current = { 
      ...boss.current, 
      phase: 1,
      x: WORLD_WIDTH / 2, 
      y: modifiers.monkCartmanMode ? WORLD_HEIGHT / 2 - 300 : WORLD_HEIGHT / 2 - 1400, 
      health: bossHp, 
      maxHealth: bossHp, 
      regenRate: isHard ? 30 : 15, 
      speed: modifiers.accurateMode ? 60 : (isHard ? 180 : 120),
      width: modifiers.monkCartmanMode ? 220 : 140,
      height: modifiers.monkCartmanMode ? 140 : 140,
      isHit: 0, 
      attackTimer: 0, 
      corruption: isHard ? 2000 : 0, 
      state: modifiers.monkCartmanMode ? 'NORMAL' : 'ENTRANCE_CHICKEN', 
      slamTimer: 5 
    };

    phase2Cutscene.current = {
      active: false,
      timer: 0,
      duration: 15.0,
      barHeight: 0,
      phase: 'COLLAPSE',
      stars: [],
      embers: [],
      rings: [],
      cuesFired: {},
    };
    setIsPhase2Cutscene(false);
    phase3Cutscene.current = {
      active: false,
      timer: 0,
      duration: 16.0,
      barHeight: 0,
      phase: 'SHATTER',
      stars: [],
      swirlingFoods: [],
      rings: [],
      cuesFired: {},
    };
    setIsPhase3Cutscene(false);
    minigunAccumulator.current = 0;
    minigunFoodIndex.current = 0;
    minigunShotCount.current = 0;
    minigunAimAngle.current = Math.PI / 2;
    phase3AttackDeck.current = [];
    cleanupDeathAudio();
    deathCutscene.current.active = false;
    deathCutscene.current.timer = 0;
    setIsDeathCutscene(false);
    setDeathCutsceneSec(0);

    if (!modifiers.monkCartmanMode) {
      entranceCutscene.current = {
        active: true,
        timer: 0,
        duration: 22.0,
        clouds: Array.from({ length: 28 }, (_, i) => ({
          x: Math.random(),
          y: Math.random(),
          rx: 0.14 + Math.random() * 0.22,
          ry: 0.04 + Math.random() * 0.06,
          speed: 0.18 + (i % 3) * 0.14,
          alpha: 0.2 + (i % 3) * 0.15,
          layer: i % 3,
        })),
        windStreaks: Array.from({ length: 65 }, () => ({
          x: Math.random(),
          y: Math.random(),
          len: 0.06 + Math.random() * 0.14,
          speed: 1.4 + Math.random() * 1.8,
          alpha: 0.2 + Math.random() * 0.45,
        })),
        greaseSparks: Array.from({ length: 50 }, () => ({
          x: 0.5 + (Math.random() - 0.5) * 0.25,
          y: 0.45 + (Math.random() - 0.5) * 0.2,
          vx: (Math.random() - 0.5) * 0.22,
          vy: -(0.35 + Math.random() * 0.65),
          size: 2 + Math.random() * 4,
          color: Math.random() < 0.5 ? '#fbbf24' : '#f97316',
        })),
        impactFired: false,
      };
      setIsEntranceCutscene(true);
    } else {
      entranceCutscene.current.active = false;
      setIsEntranceCutscene(false);
    }
    orbitingBurgers.current = [];
    bigMacCooldown.current = 2.0;

    if (modifiers.monkCartmanMode) {
      setDialogueMode('MONK_BOSS');
      setDialogueIndex(0);
      setGameState('DIALOGUE');
    }
    
    helicopter.current = {
      ...helicopter.current,
      active: false,
      hasPlayer: false,
      phase: 'APPROACH',
      cutsceneTimer: 0,
      ladderLength: 0,
      isAmbushed: false,
      crashTimer: 0,
      vx: 0,
      vy: 0,
    };
    setDeathCause(null);
    hasTriggeredCartman.current = false;
    deflectedSalads.current = 0;
    hasTriggeredSaladDialogue.current = false;
    pinchTriggered.current = false;
    balanceLevel.current = 0;
    isRescueEnding.current = false;
    stormRadius.current = WORLD_WIDTH / 1.5;
    screenShake.current = 0;
    cameraZoom.current = 1;
    cameraAngle.current = 0;
    cameraPitch.current = 0;
    plotTwistTriggered.current = false;
    cinematicTimer.current = 0;
    isOnMoon.current = false;
    projectiles.current = [];
    particles.current = [];
    shockwaves.current = [];
    groundMarks.current = [];
    floatingTexts.current = [];
    slashArcs.current = [];
    walls.current = [];
    hasTriggeredCartman.current = false;

    dashTimer.current = 0;
    dashCooldown.current = 0;
    dashInvuln.current = 0;
    pulseCooldown.current = 0;
    dashGhosts.current = [];
    parryFlash.current = 0;
    bossHitFlash.current = 0;
    comboCount.current = 0;
    comboTimer.current = 0;
    bossTrailHealth.current = bossHp;
    playerTrailHealth.current = player.current.maxHealth;
    prevBossState.current = boss.current.state;
    hitStopTimer.current = 0;
    impactFrame.current.active = false;
    impactFrame.current.timer = 0;
    lastHudSync.current = 0;

    // Wall Generation
    if (modifiers.enhancedMap) {
      for (let i = 0; i < 20; i++) {
        const w = 150 + Math.random() * 400;
        const h = 150 + Math.random() * 400;
        const x = Math.random() * (WORLD_WIDTH - w);
        const y = Math.random() * (WORLD_HEIGHT - h);
        
        // Don't spawn walls inside player/boss starting area
        const distToStart = Math.hypot(x + w / 2 - WORLD_WIDTH / 2, y + h / 2 - WORLD_HEIGHT / 2);
        if (distToStart > 600) {
          walls.current.push({ x, y, width: w, height: h, color: '#334155' });
        }
      }
    }

    // Chaos Mode Initialization
    if (modifiers.randomChaos) {
      const mods = {
        lowGravity: Math.random() < 0.3,
        doubleSpeed: Math.random() < 0.3,
        invertedControls: Math.random() < 0.3,
        giantBoss: Math.random() < 0.3,
        tinyPlayer: Math.random() < 0.3,
      };
      
      // Ensure at least one mod is active
      if (!Object.values(mods).some(Boolean)) {
        mods.doubleSpeed = true;
      }
      
      chaosModifiers.current = mods;
      
      const activeList: string[] = [];
      if (mods.lowGravity) activeList.push('Floating Feasts (Low Gravity)');
      if (mods.doubleSpeed) activeList.push('Turbo Terror (Double Speed)');
      if (mods.invertedControls) activeList.push('Confused Cravings (Inverted Controls)');
      if (mods.giantBoss) activeList.push('EXTREME GORGOTOLISIS (Giant Boss)');
      if (mods.tinyPlayer) activeList.push('Bite-Sized Hero (Tiny Player)');
      setActiveModifiers(activeList);
      
      if (mods.giantBoss) {
        boss.current.width *= 2.5;
        boss.current.height *= 2.5;
        boss.current.health *= 1.5;
        boss.current.maxHealth *= 1.5;
      }
      if (mods.tinyPlayer) {
        player.current.width *= 0.5;
        player.current.height *= 0.5;
      }
    } else {
      chaosModifiers.current = {
        lowGravity: false,
        doubleSpeed: false,
        invertedControls: false,
        giantBoss: false,
        tinyPlayer: false,
      };
      setActiveModifiers([]);
    }

    // Dimension Tears
    dimensionTears.current = [];
    if (modifiers.dimensionTear) {
      for (let i = 0; i < 2; i++) {
        const x1 = 500 + Math.random() * (WORLD_WIDTH - 1000);
        const y1 = 500 + Math.random() * (WORLD_HEIGHT - 1000);
        const x2 = 500 + Math.random() * (WORLD_WIDTH - 1000);
        const y2 = 500 + Math.random() * (WORLD_HEIGHT - 1000);
        const idx = dimensionTears.current.length;
        dimensionTears.current.push({ x: x1, y: y1, radius: 120, partnerIndex: idx + 1 });
        dimensionTears.current.push({ x: x2, y: y2, radius: 120, partnerIndex: idx });
      }
    }

    pendingBossMusicSeekRef.current = null;
    setBossMusicStartAt22(false);
    setDialogueIndex(0);
    setGameState('PLAYING');
    setIsPaused(false);

    setMusicPlaying(true);
    syncBattleHud(true);
  };

  const stopGame = (result: GameState) => {
    cleanupDeathAudio();
    pendingBossMusicSeekRef.current = null;
    setBossMusicStartAt22(false);
    entranceCutscene.current.active = false;
    setIsEntranceCutscene(false);
    phase2Cutscene.current.active = false;
    setIsPhase2Cutscene(false);
    phase3Cutscene.current.active = false;
    setIsPhase3Cutscene(false);
    deathCutscene.current.active = false;
    setIsDeathCutscene(false);
    hitStopTimer.current = 0;
    impactFrame.current.active = false;
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    setGameState(result);
    setMusicPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    if (result === 'VICTORY' || result === 'GAME_OVER') {
      const finalScore = Math.floor(boss.current.corruption + player.current.health);
      saveGameSession(result === 'VICTORY' ? 'VICTORY' : 'GAME_OVER', finalScore);
    }
  };

  const spawnParticles = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      particles.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 300,
        vy: (Math.random() - 0.5) * 300,
        life: 1,
        maxLife: 0.5 + Math.random() * 0.5,
        color,
        size: Math.random() * 5 + 2,
      });
    }
  };

  const spawnShockwave = (x: number, y: number, color = 'rgba(239, 68, 68, 0.8)', maxRadius = 450, speed = 800, width = 6) => {
    shockwaves.current.push({ x, y, radius: 10, maxRadius, speed, color, width });
  };

  const spawnGroundMark = (
    x: number,
    y: number,
    radius: number,
    type: GroundMark['type'],
    color = '#f59e0b',
    maxLife = 10
  ) => {
    if (groundMarks.current.length >= 36) {
      groundMarks.current.shift();
    }
    groundMarks.current.push({
      x,
      y,
      radius,
      type,
      angle: Math.random() * Math.PI * 2,
      life: maxLife,
      maxLife,
      color,
    });
  };

  const spawnFloatingText = (
    x: number,
    y: number,
    text: string,
    color = '#ffffff',
    size = 20
  ) => {
    if (floatingTexts.current.length >= 40) {
      floatingTexts.current.shift();
    }
    floatingTexts.current.push({
      x: x + (Math.random() - 0.5) * 24,
      y: y - 10,
      vy: -75 - Math.random() * 25,
      text,
      color,
      life: 0.95,
      maxLife: 0.95,
      size,
    });
  };

  const spawnSlashArc = (x: number, y: number, angle: number, radius = 58, color = '#4ade80') => {
    slashArcs.current.push({
      x,
      y,
      angle,
      radius,
      color,
      life: 0.24,
      maxLife: 0.24,
    });
  };

  const triggerImpactFrame = (
    x: number,
    y: number,
    accent = '#ef4444',
    duration = 0.048,
    hitStop = 0.025,
    isScreenCoord = false
  ) => {
    impactFrame.current = {
      active: true,
      timer: 0,
      duration,
      x,
      y,
      accent,
      seed: Math.floor(Math.random() * 10000) + 1,
      isScreenCoord,
    };
    if (hitStop > 0) {
      hitStopTimer.current = Math.max(hitStopTimer.current, hitStop);
    }
  };

  const syncBattleHud = (force = false) => {
    const now = performance.now();
    if (!force && now - lastHudSync.current < 55) return;
    lastHudSync.current = now;
    setBattleHud({
      bossHealth: Math.max(0, boss.current.health),
      bossMaxHealth: Math.max(1, boss.current.maxHealth),
      bossTrailHealth: Math.max(0, bossTrailHealth.current),
      bossRegen: Math.round(boss.current.regenRate),
      bossCorruption: Math.round(boss.current.corruption),
      bossPhase: boss.current.phase || 1,
      bossState: boss.current.state,
      playerHealth: Math.max(0, player.current.health),
      playerMaxHealth: Math.max(1, player.current.maxHealth),
      playerTrailHealth: Math.max(0, playerTrailHealth.current),
      combo: comboCount.current,
      dashCd: Math.max(0, dashCooldown.current),
      dashMaxCd: 3.0,
      pulseCd: Math.max(0, pulseCooldown.current),
      pulseMaxCd: 7.0,
      deflectedCount: deflectedSalads.current,
      isInvuln: dashInvuln.current > 0 || godMode.current || modifiers.godMode,
      balanceLevel: balanceLevel.current,
    });
  };

  const triggerDash = () => {
    if (
      gameState !== 'PLAYING' ||
      isPaused ||
      entranceCutscene.current.active ||
      phase2Cutscene.current.active ||
      deathCutscene.current.active ||
      dashCooldown.current > 0 ||
      player.current.stunTimer > 0
    ) {
      return;
    }

    let dx = 0;
    let dy = 0;
    if (modifiers.mode3D) {
      let fwd = 0;
      let strafe = 0;
      if (keys.current['w'] || keys.current['arrowup']) fwd += 1;
      if (keys.current['s'] || keys.current['arrowdown']) fwd -= 1;
      if (keys.current['a']) strafe -= 1;
      if (keys.current['d']) strafe += 1;
      if (fwd === 0 && strafe === 0) fwd = 1;
      const len = Math.hypot(fwd, strafe) || 1;
      fwd /= len;
      strafe /= len;
      const sinA = Math.sin(cameraAngle.current);
      const cosA = Math.cos(cameraAngle.current);
      dx = sinA * fwd + cosA * strafe;
      dy = -cosA * fwd + sinA * strafe;
    } else {
      if (keys.current['w'] || keys.current['arrowup']) dy -= 1;
      if (keys.current['s'] || keys.current['arrowdown']) dy += 1;
      if (keys.current['a'] || keys.current['arrowleft']) dx -= 1;
      if (keys.current['d'] || keys.current['arrowright']) dx += 1;
      if (dx === 0 && dy === 0) {
        const { width: CANVAS_WIDTH, height: CANVAS_HEIGHT } = dimensionsRef.current;
        const cameraX = Math.max(0, Math.min(WORLD_WIDTH - CANVAS_WIDTH, player.current.x - CANVAS_WIDTH / 2));
        const cameraY = Math.max(0, Math.min(WORLD_HEIGHT - CANVAS_HEIGHT, player.current.y - CANVAS_HEIGHT / 2));
        const ang = Math.atan2(mousePos.current.y + cameraY - player.current.y, mousePos.current.x + cameraX - player.current.x);
        dx = Math.cos(ang);
        dy = Math.sin(ang);
      } else {
        const len = Math.hypot(dx, dy) || 1;
        dx /= len;
        dy /= len;
      }
    }

    dashDir.current = { x: dx, y: dy };
    dashTimer.current = 0.2;
    dashInvuln.current = 0.3;
    dashCooldown.current = 3.0;
    const dashAngle = Math.atan2(dy, dx);
    spawnShockwave(player.current.x, player.current.y, '#38bdf8', 150, 750, 5);
    spawnSlashArc(player.current.x, player.current.y, dashAngle + Math.PI, 48, '#38bdf8');
    spawnParticles(player.current.x, player.current.y, '#38bdf8', 14);
    spawnFloatingText(player.current.x, player.current.y - 26, 'PHASE DASH!', '#38bdf8', 16);
    battleSfxRef.current?.playDash();
    syncBattleHud(true);
  };

  const triggerNutriPulse = () => {
    if (
      gameState !== 'PLAYING' ||
      isPaused ||
      entranceCutscene.current.active ||
      phase2Cutscene.current.active ||
      deathCutscene.current.active ||
      pulseCooldown.current > 0 ||
      player.current.stunTimer > 0
    ) {
      return;
    }

    pulseCooldown.current = 7.0;
    dashInvuln.current = Math.max(dashInvuln.current, 0.28);
    parryFlash.current = 0.36;
    screenShake.current = Math.max(screenShake.current, 16);

    const px = player.current.x;
    const py = player.current.y;
    spawnShockwave(px, py, '#4ade80', 340, 1200, 9);
    spawnShockwave(px, py, '#fbbf24', 240, 950, 5);
    spawnParticles(px, py, '#4ade80', 26);
    for (let a = 0; a < 4; a++) {
      spawnSlashArc(px, py, (a * Math.PI) / 2, 75, '#4ade80');
    }

    let clearedCount = 0;
    let parriedCount = 0;

    for (let i = projectiles.current.length - 1; i >= 0; i--) {
      const p = projectiles.current[i];
      if (!p || p.isPlayer) continue;
      const dist = Math.hypot(p.x - px, p.y - py);

      if (p.isHealthy && dist <= 340) {
        p.isPlayer = true;
        const ang = Math.atan2(boss.current.y - p.y, boss.current.x - p.x);
        p.vx = Math.cos(ang) * 1050;
        p.vy = Math.sin(ang) * 1050;
        p.trail = [{ x: p.x, y: p.y }];
        player.current.health = Math.min(player.current.maxHealth, player.current.health + 15);
        parriedCount++;
        comboCount.current += 1;
        comboTimer.current = 3.5;
        deflectedSalads.current++;
        spawnParticles(p.x, p.y, '#4ade80', 10);
      } else if (!p.isHealthy && !p.isBandAid && !p.isSodaBlast && dist <= 280) {
        spawnParticles(p.x, p.y, '#fbbf24', 8);
        projectiles.current.splice(i, 1);
        clearedCount++;
      }
    }

    const label =
      parriedCount > 0
        ? `NUTRI-PULSE! ${parriedCount}x PARRY!`
        : clearedCount > 0
          ? `NUTRI-PULSE! ${clearedCount} CLEARED`
          : 'NUTRI-PULSE!';
    spawnFloatingText(px, py - 34, label, '#4ade80', 20);
    battleSfxRef.current?.playPulse();
    syncBattleHud(true);
  };

  const summonOrbitingBigMacs = () => {
    const burgerCount = 6;
    const newBurgers: OrbitingBigMac[] = [];
    const baseRadius = 160;
    for (let i = 0; i < burgerCount; i++) {
      const angle = (i / burgerCount) * Math.PI * 2;
      newBurgers.push({
        id: Math.random(),
        angle,
        orbitRadius: baseRadius,
        orbitSpeed: 2.2,
        state: 'ORBITING',
        throwTimer: 2.2 + i * 1.4,
        x: boss.current.x + Math.cos(angle) * baseRadius,
        y: boss.current.y + Math.sin(angle) * baseRadius,
        vx: 0,
        vy: 0,
        rotation: 0,
        width: 85,
        height: 85,
        damage: 28,
      });
    }
    orbitingBurgers.current = newBurgers;
    spawnShockwave(boss.current.x, boss.current.y, '#f59e0b', 340, 520, 8);
    spawnParticles(boss.current.x, boss.current.y, '#fbbf24', 30);
  };

  const finishEntranceCutscene = (skipped = false) => {
    const targetY = WORLD_HEIGHT / 2 - 300;
    entranceCutscene.current.active = false;
    setIsEntranceCutscene(false);
    boss.current.state = 'NORMAL';
    boss.current.x = WORLD_WIDTH / 2;
    boss.current.y = targetY;
    fightTimer.current = 22.0;
    screenShake.current = 45;
    spawnGroundMark(boss.current.x, targetY + 30, 175, 'CRATER', '#f59e0b', 18);
    spawnShockwave(boss.current.x, targetY, '#fbbf24', 700, 1200, 10);
    spawnShockwave(boss.current.x, targetY, '#f59e0b', 450, 800, 6);
    spawnParticles(boss.current.x, targetY, '#f59e0b', 45);

    if (skipped) {
      setBossMusicStartAt22(true);
      const audio = battleAudioRef.current;
      if (audio) {
        if (audio.readyState >= 1) {
          audio.currentTime = 22;
          pendingBossMusicSeekRef.current = null;
        } else {
          pendingBossMusicSeekRef.current = 22;
        }
        audio.play().catch(() => {});
      } else {
        pendingBossMusicSeekRef.current = 22;
      }
    }
  };

  const playPhase2AudioCue = (cue: 'collapse' | 'awakening' | 'explosion' | 'ascended') => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!cutsceneAudioCtxRef.current || cutsceneAudioCtxRef.current.state === 'closed') {
        cutsceneAudioCtxRef.current = new AudioCtx();
      }
      const ctx = cutsceneAudioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;

      const playTone = (freq: number, endFreq: number, type: OscillatorType, startOffset: number, dur: number, vol: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now + startOffset);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + startOffset + dur);
        gain.gain.setValueAtTime(0.0001, now + startOffset);
        gain.gain.linearRampToValueAtTime(vol, now + startOffset + Math.min(0.12, dur * 0.2));
        gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + startOffset);
        osc.stop(now + startOffset + dur + 0.05);
      };

      const playBurst = (startOffset: number, dur: number, filterFreq: number, vol: number) => {
        const bufferSize = Math.floor(ctx.sampleRate * dur);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
        }
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(filterFreq, now + startOffset);
        filter.frequency.exponentialRampToValueAtTime(70, now + startOffset + dur);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vol, now + startOffset);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + dur);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        src.start(now + startOffset);
      };

      if (cue === 'collapse') {
        playBurst(0, 1.0, 700, 0.24);
        playTone(98, 32, 'sawtooth', 0, 2.8, 0.14);
        playTone(55, 45, 'sine', 0.2, 3.2, 0.18);
      } else if (cue === 'awakening') {
        playTone(65, 220, 'sawtooth', 0, 4.4, 0.12);
        playTone(130, 440, 'triangle', 0.4, 4.0, 0.08);
        playBurst(1.2, 0.4, 1500, 0.14);
        playBurst(2.8, 0.4, 1800, 0.16);
      } else if (cue === 'explosion') {
        playBurst(0, 2.8, 2400, 0.36);
        playTone(110, 26, 'sawtooth', 0, 2.8, 0.22);
        [146.83, 220.0, 277.18, 329.63].forEach((f, idx) => {
          playTone(f, f * 0.99, 'sawtooth', 0.15 + idx * 0.06, 2.6, 0.075);
        });
      } else if (cue === 'ascended') {
        [110, 164.81, 220, 329.63].forEach((f, idx) => {
          playTone(f, f, 'triangle', idx * 0.08, 2.8, 0.08);
        });
      }
    } catch {
      // Optional audio
    }
  };

  const applyPhase2BossTransform = () => {
    activeBossImage.current = modifiers.monkCartmanMode ? helicopterImage : bossPhase2Image;
    boss.current.phase = 2;
    boss.current.state = 'RAGE';
    boss.current.width = 190;
    boss.current.height = 190;
    boss.current.maxHealth = Math.round(boss.current.maxHealth * 1.35);
    boss.current.health = boss.current.maxHealth;
    boss.current.corruption = 100000;
    boss.current.regenRate = 28;
  };

  const startPhase2Cinematic = () => {
    if (phase2Cutscene.current.active) return;
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    setShowAdminPanel(false);
    setIsPaused(false);

    boss.current.health = 0;
    boss.current.phase = 2;
    boss.current.state = 'RAGE';

    const stars = Array.from({ length: 140 }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: 0.8 + Math.random() * 2.2,
      twinkle: Math.random() * Math.PI * 2,
    }));
    const emberColors = ['#f59e0b', '#ef4444', '#fef08a', '#fb7185'];
    const embers = Array.from({ length: 75 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.08,
      vy: -(0.08 + Math.random() * 0.24),
      size: 1.5 + Math.random() * 3.5,
      color: emberColors[Math.floor(Math.random() * emberColors.length)],
    }));

    phase2Cutscene.current = {
      active: true,
      timer: 0,
      duration: 15.0,
      barHeight: 0,
      phase: 'COLLAPSE',
      stars,
      embers,
      rings: [],
      cuesFired: { collapse: true },
    };
    setIsPhase2Cutscene(true);
    screenShake.current = 24;
    projectiles.current = projectiles.current.filter(p => p.isPlayer);
    playPhase2AudioCue('collapse');
  };

  const finishPhase2Cinematic = () => {
    const cut = phase2Cutscene.current;
    if (cut.phase === 'COLLAPSE' || cut.phase === 'AWAKENING') {
      applyPhase2BossTransform();
    }
    if (orbitingBurgers.current.length === 0) {
      summonOrbitingBigMacs();
    }
    cleanupDeathAudio();
    cut.active = false;
    cut.barHeight = 0;
    setIsPhase2Cutscene(false);
  };

  const playPhase3AudioCue = (cue: 'shatter' | 'absorb' | 'detonation' | 'unleashed') => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!cutsceneAudioCtxRef.current || cutsceneAudioCtxRef.current.state === 'closed') {
        cutsceneAudioCtxRef.current = new AudioCtx();
      }
      const ctx = cutsceneAudioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;

      const playTone = (freq: number, endFreq: number, type: OscillatorType, startOffset: number, dur: number, vol: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now + startOffset);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + startOffset + dur);
        gain.gain.setValueAtTime(0.0001, now + startOffset);
        gain.gain.linearRampToValueAtTime(vol, now + startOffset + Math.min(0.12, dur * 0.25));
        gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + startOffset);
        osc.stop(now + startOffset + dur + 0.05);
      };

      const playBurst = (startOffset: number, dur: number, filterFreq: number, vol: number) => {
        const bufferSize = Math.floor(ctx.sampleRate * dur);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
        }
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(filterFreq, now + startOffset);
        filter.frequency.exponentialRampToValueAtTime(80, now + startOffset + dur);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vol, now + startOffset);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + dur);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        src.start(now + startOffset);
      };

      if (cue === 'shatter') {
        playBurst(0, 1.3, 1200, 0.24);
        playTone(130, 38, 'sawtooth', 0, 2.8, 0.14);
      } else if (cue === 'absorb') {
        // Trillion-calorie vacuum vortex swell
        playTone(55, 290, 'sawtooth', 0, 5.4, 0.13);
        playTone(110, 580, 'triangle', 0.3, 5.1, 0.09);
        for (let i = 0; i < 12; i++) {
          playTone(320 + i * 55, 640 + i * 70, 'sine', i * 0.42, 0.28, 0.055);
        }
      } else if (cue === 'detonation') {
        playBurst(0, 3.0, 2600, 0.36);
        playTone(95, 24, 'sawtooth', 0, 2.9, 0.22);
        [196, 293.66, 392, 587.33].forEach((f, idx) => {
          playTone(f, f * 1.01, 'sawtooth', 0.12 + idx * 0.07, 2.5, 0.08);
        });
      } else if (cue === 'unleashed') {
        // Minigun rotary barrel spin-up whir
        playTone(90, 480, 'sawtooth', 0, 1.6, 0.12);
        for (let k = 0; k < 8; k++) {
          playBurst(1.0 + k * 0.06, 0.05, 1800, 0.12);
        }
      }
    } catch {
      // Optional audio
    }
  };

  const applyPhase3BossTransform = () => {
    activeBossImage.current = modifiers.monkCartmanMode ? helicopterImage : bossPhase3Image;
    boss.current.phase = 3;
    boss.current.state = 'MINIGUN_BARRAGE';
    boss.current.width = 215;
    boss.current.height = 215;
    const baseHp = modifiers.hardMode ? 10000 : 5000;
    boss.current.maxHealth = Math.round(baseHp * 1.85);
    boss.current.health = boss.current.maxHealth;
    boss.current.corruption = 100000;
    boss.current.regenRate = 24;
    boss.current.slamTimer = 4.2;
    boss.current.attackTimer = 0;
    minigunAccumulator.current = 0;
    minigunAimAngle.current = Math.atan2(player.current.y - boss.current.y, player.current.x - boss.current.x);
  };

  const startPhase3Cinematic = () => {
    if (phase3Cutscene.current.active) return;
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    setShowAdminPanel(false);
    setIsPaused(false);

    boss.current.health = 0;
    boss.current.phase = 3;
    boss.current.state = 'RAGE';
    orbitingBurgers.current = [];

    const stars = Array.from({ length: 160 }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: 0.8 + Math.random() * 2.4,
      twinkle: Math.random() * Math.PI * 2,
    }));
    const ringColors = ['#fbbf24', '#ef4444', '#a855f7', '#fb923c', '#38bdf8'];
    const swirlingFoods = Array.from({ length: 140 }, (_, i) => ({
      angle: (i / 140) * Math.PI * 2 + Math.random() * 0.4,
      dist: 0.28 + Math.random() * 0.72,
      speed: 1.5 + Math.random() * 2.6,
      pullSpeed: 0.14 + Math.random() * 0.22,
      size: 24 + (i % 5) * 6,
      foodIdx: i % 14,
      rot: Math.random() * Math.PI * 2,
      color: ringColors[i % ringColors.length],
    }));

    phase3Cutscene.current = {
      active: true,
      timer: 0,
      duration: 16.0,
      barHeight: 0,
      phase: 'SHATTER',
      stars,
      swirlingFoods,
      rings: [],
      cuesFired: { shatter: true },
    };
    setIsPhase3Cutscene(true);
    screenShake.current = 28;
    projectiles.current = projectiles.current.filter(p => p.isPlayer);
    playPhase3AudioCue('shatter');
  };

  const finishPhase3Cinematic = () => {
    const cut = phase3Cutscene.current;
    if (cut.phase === 'SHATTER' || cut.phase === 'ABSORBING') {
      applyPhase3BossTransform();
    }
    if (orbitingBurgers.current.length === 0) {
      summonOrbitingBigMacs();
    }
    cleanupDeathAudio();
    cut.active = false;
    cut.barHeight = 0;
    setIsPhase3Cutscene(false);
  };

  const spawnJunkFoodItem = (
    x: number,
    y: number,
    vx: number,
    vy: number,
    catalogIdx: number,
    radiusOverride?: number,
    isMinigun = false
  ) => {
    const idx = ((catalogIdx % 14) + 14) % 14;
    let emoji = '🍔';
    let radius = 18;
    let isDongfish = false;
    let isOreo = false;
    let isChef = false;
    let isOatmeal = false;
    let isBigMac = false;
    let isCherryCoke = false;
    let isCreamPepsi = false;

    switch (idx) {
      case 0: emoji = '🍔'; radius = 17; break;
      case 1: emoji = '🍟'; radius = 17; break;
      case 2: emoji = '🥤'; radius = 17; break;
      case 3: emoji = '🍕'; radius = 18; break;
      case 4: emoji = '🍩'; radius = 17; break;
      case 5: emoji = '🌭'; radius = 17; break;
      case 6: emoji = '🍗'; radius = 19; break; // Rotisserie chicken (uses junkFoodImage)
      case 7: emoji = '🍪'; radius = 21; isOreo = true; break;
      case 8: emoji = '🥫'; radius = 19; isChef = true; break;
      case 9: emoji = '🍪'; radius = 20; isOatmeal = true; break;
      case 10: emoji = '🐟'; radius = 20; isDongfish = true; break;
      case 11: emoji = '🍔'; radius = 22; isBigMac = true; break;
      case 12: emoji = '🥤'; radius = 19; isCherryCoke = true; break;
      case 13: emoji = '🥤'; radius = 19; isCreamPepsi = true; break;
    }

    projectiles.current.push({
      x,
      y,
      vx,
      vy,
      radius: radiusOverride ?? radius,
      emoji,
      isPlayer: false,
      isHealthy: false,
      isDongfish,
      isOreo,
      isChef,
      isOatmeal,
      isBigMac,
      isCherryCoke,
      isCreamPepsi,
      isMinigun,
      rotation: Math.atan2(vy, vx),
      rotationSpeed: isDongfish ? 0 : (isMinigun ? 9 : 11),
    });
  };

  const cleanupDeathAudio = () => {
    if (cutsceneAudioCtxRef.current) {
      try {
        cutsceneAudioCtxRef.current.close();
      } catch {
        // Ignore audio context close error
      }
      cutsceneAudioCtxRef.current = null;
    }
  };

  const playDeathAudioCue = (cue: 'act1' | 'act2' | 'act3' | 'silence' | 'supernova' | 'dawn' | 'curtain') => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!cutsceneAudioCtxRef.current || cutsceneAudioCtxRef.current.state === 'closed') {
        cutsceneAudioCtxRef.current = new AudioCtx();
      }
      const ctx = cutsceneAudioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;

      const playTone = (freq: number, endFreq: number, type: OscillatorType, startOffset: number, dur: number, vol: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now + startOffset);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + startOffset + dur);
        gain.gain.setValueAtTime(0.0001, now + startOffset);
        gain.gain.linearRampToValueAtTime(vol, now + startOffset + Math.min(0.15, dur * 0.25));
        gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + startOffset);
        osc.stop(now + startOffset + dur + 0.05);
      };

      const playNoiseBurst = (startOffset: number, dur: number, filterFreq: number, vol: number) => {
        const bufferSize = Math.floor(ctx.sampleRate * dur);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
        }
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(filterFreq, now + startOffset);
        filter.frequency.exponentialRampToValueAtTime(60, now + startOffset + dur);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vol, now + startOffset);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + dur);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        src.start(now + startOffset);
      };

      if (cue === 'act1') {
        playNoiseBurst(0, 1.4, 900, 0.28);
        playTone(110, 34, 'sawtooth', 0, 2.2, 0.14);
        playTone(55, 28, 'sine', 0, 4.5, 0.22);
        // Heartbeat pulses
        for (let b = 0; b < 6; b++) {
          playTone(65, 32, 'sine', 2.0 + b * 1.2, 0.45, 0.16);
        }
      } else if (cue === 'act2') {
        playNoiseBurst(0, 2.5, 500, 0.18);
        playTone(73.42, 48, 'sawtooth', 0, 6.0, 0.09);
        playTone(146.83, 138, 'triangle', 0.2, 5.5, 0.07);
        playNoiseBurst(8.0, 1.8, 1200, 0.22); // Core failure shatter at 18s
      } else if (cue === 'act3') {
        // Rising harmonic singularity swell over 12s
        playTone(130.81, 261.63, 'sine', 0, 11.5, 0.12);
        playTone(196.0, 392.0, 'triangle', 1.5, 10.0, 0.08);
        playTone(261.63, 523.25, 'sine', 4.0, 7.5, 0.07);
      } else if (cue === 'silence') {
        playTone(880, 110, 'sine', 0, 0.65, 0.08);
      } else if (cue === 'supernova') {
        playNoiseBurst(0, 3.8, 2200, 0.35);
        playTone(90, 24, 'sawtooth', 0, 3.5, 0.2);
        // Shimmering crystal chord
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, idx) => {
          playTone(freq, freq * 1.005, 'sine', 0.25 + idx * 0.14, 5.0, 0.07);
        });
      } else if (cue === 'dawn') {
        // Warm sunrise major-9 chord pad
        [261.63, 329.63, 392.0, 493.88, 587.33].forEach((freq, idx) => {
          playTone(freq, freq, 'sine', idx * 0.2, 8.5, 0.065);
        });
      } else if (cue === 'curtain') {
        // Triumphant final arpeggio chime
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
          playTone(freq, freq, 'triangle', idx * 0.16, 3.8, 0.08);
        });
      }
    } catch {
      // Audio playback optional
    }
  };

  const startDeathCutscene = () => {
    if (deathCutscene.current.active) return;
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    setShowAdminPanel(false);
    setIsPaused(false);
    setMusicPlaying(false);
    if (battleAudioRef.current) {
      battleAudioRef.current.pause();
    }
    boss.current.health = 0;
    projectiles.current = [];
    orbitingBurgers.current = [];
    shockwaves.current = [];
    particles.current = [];

    const starPalette = ['#ffffff', '#fef08a', '#bae6fd', '#fbcfe8', '#a7f3d0'];
    const stars = Array.from({ length: 190 }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: 0.8 + Math.random() * 2.4,
      twinkle: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 1.4,
      color: starPalette[Math.floor(Math.random() * starPalette.length)],
    }));

    const monoliths = Array.from({ length: 16 }, (_, i) => ({
      x: (i / 15) * 1.15 - 0.075 + (Math.random() - 0.5) * 0.06,
      y: 0.25 + Math.random() * 0.55,
      w: 36 + Math.random() * 68,
      h: 130 + Math.random() * 260,
      fallSpeed: 0.015 + Math.random() * 0.04,
      tilt: (Math.random() - 0.5) * 0.35,
      rotSpeed: (Math.random() - 0.5) * 0.25,
      depth: 0.4 + Math.random() * 0.8,
      color: Math.random() < 0.5 ? '#1e1b4b' : '#31102f',
    }));

    const cracks = Array.from({ length: 14 }, (_, i) => {
      const baseAngle = (i / 14) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const segments: { dx: number; dy: number }[] = [];
      let cx = 0;
      let cy = 0;
      for (let s = 0; s < 5; s++) {
        const a = baseAngle + (Math.random() - 0.5) * 0.65;
        const len = 18 + Math.random() * 26;
        cx += Math.cos(a) * len;
        cy += Math.sin(a) * len;
        segments.push({ dx: cx, dy: cy });
      }
      return {
        angle: baseAngle,
        segments,
        width: 2 + Math.random() * 3.5,
        delay: (i / 14) * 5.2,
      };
    });

    const shardColors = ['#fbbf24', '#4ade80', '#f87171', '#fef08a', '#38bdf8', '#f472b6'];
    const bossShards = Array.from({ length: 115 }, (_, i) => {
      const ang = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 320;
      const isJunkSpirit = i < 24;
      return {
        x: (Math.random() - 0.5) * 140,
        y: (Math.random() - 0.5) * 140,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - (isJunkSpirit ? 40 : 85),
        size: isJunkSpirit ? 26 : 5 + Math.random() * 14,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 7,
        color: shardColors[i % shardColors.length],
        delay: isJunkSpirit ? (i / 24) * 7.5 : Math.random() * 3.5,
        emoji: isJunkSpirit ? JUNK_FOODS[i % JUNK_FOODS.length] : undefined,
      };
    });

    const nutrientEmojis = ['🥗', '🍎', '🥦', '🥕', '🍃', '✨'];
    const ribbons = Array.from({ length: 24 }, (_, i) => ({
      angleOffset: (i / 24) * Math.PI * 2,
      speed: 1.4 + (i % 4) * 0.45,
      radiusScale: 0.7 + (i % 3) * 0.25,
      color: i % 2 === 0 ? '#4ade80' : '#fbbf24',
      emoji: nutrientEmojis[i % nutrientEmojis.length],
    }));

    deathCutscene.current = {
      active: true,
      timer: 0,
      duration: 60.0,
      stars,
      monoliths,
      cracks,
      bossShards,
      ribbons,
      rings: [],
      cuesFired: { act1: true },
    };

    setIsDeathCutscene(true);
    setDeathCutsceneSec(0);
    playDeathAudioCue('act1');
  };

  const finishDeathCutscene = () => {
    cleanupDeathAudio();
    deathCutscene.current.active = false;
    setIsDeathCutscene(false);
    stopGame('VICTORY');
  };

  const fetchAIDecision = async () => {
    try {
      const pX = Math.round(player.current.x);
      const bX = Math.round(boss.current.x);
      const pHp = Math.round(player.current.health);
      const bHp = Math.round(boss.current.health);
      const corr = Math.round(boss.current.corruption);
      
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: `You are the malicious final boss director in a 2D bullet hell game. 
Player X: ${pX}. Boss X: ${bX}. 
Player HP: ${pHp}/100. Boss HP: ${bHp}. Corruption: ${corr}.
Choose your next attack state to ruin the player's day.
Available states: 'NORMAL', 'SLAMMING' (chase dash), 'OATMEAL_WALL' (defensive), 'CHEF_SPIN' (AoE), 'CHERRY_CHARGE' (fast dash), 'SUMMONING_DONGFISH', 'OREO_SANDWICH', 'ULTIMATE_SPAM' (panic).
Return ONLY the exact state name from the list above. No quotes, no markdown, no explanation.`,
        config: {
          systemInstruction: "You are a merciless game logic AI.",
          temperature: 0.9,
          maxOutputTokens: 10,
        }
      });
      
      const text = response.text?.trim().toUpperCase();
      const validStates = ['SLAMMING', 'OATMEAL_WALL', 'CHEF_SPIN', 'CHERRY_CHARGE', 'SUMMONING_DONGFISH', 'ULTIMATE_SPAM', 'NORMAL', 'OREO_SANDWICH'];
      
      if (text && validStates.includes(text)) {
         aiDecision.current = text as Boss['state'];
      }
    } catch (e) {
       console.error("AI fetch failed, falling back to random", e);
    }
  };

  const update = (dt: number) => {
    if (gameState !== 'PLAYING' || isPaused) return;

    if (impactFrame.current.active) {
      impactFrame.current.timer += Math.min(dt, 0.033);
      if (impactFrame.current.timer >= impactFrame.current.duration) {
        impactFrame.current.active = false;
      }
    }

    if (hitStopTimer.current > 0) {
      hitStopTimer.current = Math.max(0, hitStopTimer.current - dt);
      if (screenShake.current > 0) {
        screenShake.current = Math.max(0, screenShake.current - 10 * dt);
      }
      return;
    }

    if (sneezeTimer.current > 0) {
      sneezeTimer.current -= dt;
    }

    // Phase 2 Transformation Cinematic Cutscene (15.0s Multi-Act Ascension)
    if (phase2Cutscene.current.active) {
      const cut = phase2Cutscene.current;
      const safeDt = Math.min(dt, 0.05);
      cut.timer += safeDt;
      const { height: CANVAS_HEIGHT } = dimensionsRef.current;
      const targetBarHeight = Math.min(115, CANVAS_HEIGHT * 0.14);

      if (cut.timer < 0.7) {
        cut.barHeight = (cut.timer / 0.7) * targetBarHeight;
      } else if (cut.timer > cut.duration - 0.7) {
        cut.barHeight = Math.max(0, ((cut.duration - cut.timer) / 0.7) * targetBarHeight);
      } else {
        cut.barHeight = targetBarHeight;
      }

      // Advance molten embers
      cut.embers.forEach(em => {
        em.x = (em.x + em.vx * safeDt + 1) % 1;
        em.y = (em.y + em.vy * safeDt + 1) % 1;
      });

      // Advance shockwave rings
      for (let i = cut.rings.length - 1; i >= 0; i--) {
        const r = cut.rings[i];
        r.radius += r.speed * safeDt;
        if (r.radius >= r.maxRadius) cut.rings.splice(i, 1);
      }

      // Phase progression
      if (cut.timer < 3.5) {
        cut.phase = 'COLLAPSE';
        boss.current.isHit = 0.2;
      } else if (cut.timer < 8.1) {
        if (cut.phase === 'COLLAPSE') {
          cut.phase = 'AWAKENING';
          if (!cut.cuesFired.awakening) {
            cut.cuesFired.awakening = true;
            playPhase2AudioCue('awakening');
          }
          cut.rings.push({ radius: 20, maxRadius: 1400, speed: 680, color: '#ef4444', width: 8 });
        }
      } else if (cut.timer < 11.2) {
        if (cut.phase === 'AWAKENING') {
          cut.phase = 'EXPLOSION';
          applyPhase2BossTransform();
          if (!cut.cuesFired.explosion) {
            cut.cuesFired.explosion = true;
            playPhase2AudioCue('explosion');
          }
          cut.rings.push({ radius: 10, maxRadius: 2200, speed: 1250, color: '#ffffff', width: 20 });
          cut.rings.push({ radius: 10, maxRadius: 2000, speed: 980, color: '#fbbf24', width: 14 });
          cut.rings.push({ radius: 10, maxRadius: 1800, speed: 780, color: '#ef4444', width: 12 });
          cut.rings.push({ radius: 10, maxRadius: 1500, speed: 620, color: '#f97316', width: 10 });
          spawnShockwave(boss.current.x, boss.current.y, '#f59e0b', 750, 950, 16);
          screenShake.current = 36;
        }
      } else if (cut.timer < cut.duration) {
        if (cut.phase === 'EXPLOSION') {
          cut.phase = 'ASCENDED';
          summonOrbitingBigMacs();
          if (!cut.cuesFired.ascended) {
            cut.cuesFired.ascended = true;
            playPhase2AudioCue('ascended');
          }
        }
        orbitingBurgers.current.forEach(b => {
          b.angle += b.orbitSpeed * safeDt;
          b.rotation += 1.8 * safeDt;
          b.x = boss.current.x + Math.cos(b.angle) * b.orbitRadius;
          b.y = boss.current.y + Math.sin(b.angle) * b.orbitRadius;
        });
      } else {
        finishPhase2Cinematic();
      }
      return;
    }

    // Cinematic Phase 3 Cutscene (Ascended Gorgotolisis Absorbs Trillions of Calories -> Stage 3: Calories Unleashed)
    if (phase3Cutscene.current.active) {
      const cut = phase3Cutscene.current;
      const safeDt = Math.min(dt, 0.05);
      cut.timer += safeDt;

      const { height: H } = dimensionsRef.current;
      const targetBarH = Math.min(82, Math.round(H * 0.11));
      cut.barHeight = Math.min(targetBarH, cut.barHeight + safeDt * 250);

      // Update swirling junk food vortex being pulled into Gorgotolisis
      const pullMult = cut.timer >= 2.8 && cut.timer < 9.2 ? (1 + (cut.timer - 2.8) * 0.65) : 0.4;
      cut.swirlingFoods.forEach(sf => {
        sf.angle += sf.speed * pullMult * safeDt;
        sf.rot += sf.speed * 1.4 * safeDt;
        if (cut.timer >= 2.8 && cut.timer < 9.2) {
          sf.dist -= sf.pullSpeed * pullMult * safeDt;
          if (sf.dist < 0.04) {
            sf.dist = 0.85 + Math.random() * 0.25;
            sf.angle = Math.random() * Math.PI * 2;
            sf.foodIdx = (sf.foodIdx + 3) % 14;
          }
        } else if (cut.timer >= 9.2) {
          sf.dist += 1.6 * safeDt;
        }
      });

      if (cut.timer >= 2.8 && cut.timer < 9.2) {
        cut.phase = 'ABSORBING';
        if (!cut.cuesFired.absorb) {
          cut.cuesFired.absorb = true;
          playPhase3AudioCue('absorb');
          cut.rings.push({ radius: 280, maxRadius: 20, speed: -180, color: '#a855f7', width: 8 });
        }
        if (Math.random() < 0.16) {
          cut.rings.push({
            radius: 36 + Math.random() * 40,
            maxRadius: 650,
            speed: 480,
            color: Math.random() < 0.5 ? '#c084fc' : '#fbbf24',
            width: 5,
          });
        }
      } else if (cut.timer >= 9.2 && cut.timer < 12.0) {
        cut.phase = 'DETONATION';
        if (!cut.cuesFired.detonation) {
          cut.cuesFired.detonation = true;
          playPhase3AudioCue('detonation');
          applyPhase3BossTransform();
          screenShake.current = 40;
          cut.rings.push({ radius: 15, maxRadius: 2200, speed: 1200, color: '#ffffff', width: 22 });
          cut.rings.push({ radius: 15, maxRadius: 2000, speed: 950, color: '#c084fc', width: 16 });
          cut.rings.push({ radius: 15, maxRadius: 1700, speed: 760, color: '#ef4444', width: 12 });
          cut.rings.push({ radius: 15, maxRadius: 1500, speed: 620, color: '#fbbf24', width: 10 });
          triggerImpactFrame(dimensionsRef.current.width * 0.5, dimensionsRef.current.height * 0.45, '#c084fc', 0.045, 0, true);
        }
      } else if (cut.timer >= 12.0) {
        cut.phase = 'UNLEASHED';
        if (!cut.cuesFired.unleashed) {
          cut.cuesFired.unleashed = true;
          playPhase3AudioCue('unleashed');
        }
      }

      for (let i = cut.rings.length - 1; i >= 0; i--) {
        const r = cut.rings[i];
        r.radius += r.speed * safeDt;
        if ((r.speed > 0 && r.radius >= r.maxRadius) || (r.speed < 0 && r.radius <= r.maxRadius)) {
          cut.rings.splice(i, 1);
        }
      }

      if (cut.timer >= cut.duration) {
        finishPhase3Cinematic();
      }
      return;
    }

    // Full 60-Second Cinematic Boss Death Cutscene
    if (deathCutscene.current.active) {
      const dc = deathCutscene.current;
      const safeDt = Math.min(dt, 0.05);
      dc.timer += safeDt;

      const secNow = Math.min(60, Math.floor(dc.timer));
      setDeathCutsceneSec(prev => (prev !== secNow ? secNow : prev));

      if (dc.timer >= 10.0 && !dc.cuesFired.act2) {
        dc.cuesFired.act2 = true;
        playDeathAudioCue('act2');
        dc.rings.push({ radius: 20, maxRadius: 1400, speed: 650, color: '#f43f5e', width: 10 });
      }
      if (dc.timer >= 18.0 && !dc.cuesFired.coreFail) {
        dc.cuesFired.coreFail = true;
        dc.rings.push({ radius: 30, maxRadius: 1800, speed: 900, color: '#ef4444', width: 14 });
        dc.rings.push({ radius: 10, maxRadius: 1400, speed: 700, color: '#fbbf24', width: 8 });
      }
      if (dc.timer >= 22.0 && !dc.cuesFired.act3) {
        dc.cuesFired.act3 = true;
        playDeathAudioCue('act3');
      }
      if (dc.timer >= 34.0 && !dc.cuesFired.silence) {
        dc.cuesFired.silence = true;
        playDeathAudioCue('silence');
      }
      if (dc.timer >= 34.8 && !dc.cuesFired.supernova) {
        dc.cuesFired.supernova = true;
        playDeathAudioCue('supernova');
        dc.rings.push({ radius: 10, maxRadius: 2400, speed: 1200, color: '#ffffff', width: 22 });
        dc.rings.push({ radius: 10, maxRadius: 2200, speed: 980, color: '#fbbf24', width: 16 });
        dc.rings.push({ radius: 10, maxRadius: 2000, speed: 800, color: '#4ade80', width: 14 });
        dc.rings.push({ radius: 10, maxRadius: 1800, speed: 640, color: '#38bdf8', width: 12 });
      }
      if (dc.timer >= 44.0 && !dc.cuesFired.dawn) {
        dc.cuesFired.dawn = true;
        playDeathAudioCue('dawn');
      }
      if (dc.timer >= 54.0 && !dc.cuesFired.curtain) {
        dc.cuesFired.curtain = true;
        playDeathAudioCue('curtain');
      }

      // Advance expanding shockwave rings
      for (let i = dc.rings.length - 1; i >= 0; i--) {
        const r = dc.rings[i];
        r.radius += r.speed * safeDt;
        if (r.radius >= r.maxRadius) dc.rings.splice(i, 1);
      }

      // Advance crumbling monoliths during Act II & III
      if (dc.timer >= 10.0 && dc.timer < 35.0) {
        dc.monoliths.forEach(m => {
          if (dc.timer < 28.0) {
            m.y += m.fallSpeed * safeDt;
            m.tilt += m.rotSpeed * safeDt;
          } else {
            // Pull monoliths toward center singularity (28s - 34s)
            m.x += (0.5 - m.x) * safeDt * 0.9;
            m.y += (0.45 - m.y) * safeDt * 0.9;
            m.tilt += m.rotSpeed * 4 * safeDt;
          }
        });
      }

      if (dc.timer >= dc.duration) {
        finishDeathCutscene();
      }
      return;
    }

    // Trigger Phase 2 or Death Cutscene if boss health reached 0 from any source (e.g. Admin kill)
    if (
      boss.current.health <= 0 &&
      !(helicopter.current.active && helicopter.current.phase && helicopter.current.phase !== 'COMBAT')
    ) {
      if (boss.current.phase === 1) {
        startPhase2Cinematic();
      } else if (boss.current.phase === 2) {
        startPhase3Cinematic();
      } else {
        startDeathCutscene();
      }
      return;
    }

    // Update Orbiting / Thrown Big Macs (Phase 2 & Stage 3 Boss Ability)
    if (boss.current.phase >= 2 && !phase2Cutscene.current.active && !phase3Cutscene.current.active) {
      if (orbitingBurgers.current.length < 6) {
        bigMacCooldown.current -= dt;
        if (bigMacCooldown.current <= 0) {
          bigMacCooldown.current = 3.5;
          summonOrbitingBigMacs();
        }
      }
    }

    for (let i = orbitingBurgers.current.length - 1; i >= 0; i--) {
      const b = orbitingBurgers.current[i];
      if (!b) continue;
      if (b.state === 'ORBITING') {
        b.angle += b.orbitSpeed * dt;
        b.rotation += 1.8 * dt;
        b.x = boss.current.x + Math.cos(b.angle) * b.orbitRadius;
        b.y = boss.current.y + Math.sin(b.angle) * b.orbitRadius;

        b.throwTimer -= dt;
        if (b.throwTimer <= 0) {
          b.state = 'TARGETING';
          b.throwTimer = 0.48; // Brief lock-on laser telegraph before launch
          battleSfxRef.current?.playBigMacLock();
        }
      } else if (b.state === 'TARGETING') {
        b.angle += b.orbitSpeed * 0.4 * dt;
        b.rotation += 9.0 * dt;
        b.x = boss.current.x + Math.cos(b.angle) * (b.orbitRadius + 24);
        b.y = boss.current.y + Math.sin(b.angle) * (b.orbitRadius + 24);
        b.throwTimer -= dt;
        if (b.throwTimer <= 0) {
          b.state = 'THROWN';
          const angleToPlayer = Math.atan2(player.current.y - b.y, player.current.x - b.x);
          const throwSpeed = 720;
          b.vx = Math.cos(angleToPlayer) * throwSpeed;
          b.vy = Math.sin(angleToPlayer) * throwSpeed;
          spawnShockwave(b.x, b.y, '#f59e0b', 140, 520, 5);
          spawnSlashArc(b.x, b.y, angleToPlayer, 48, '#fbbf24');
          battleSfxRef.current?.playBigMacThrow();
        }
      } else if (b.state === 'THROWN') {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.rotation += 8.0 * dt;

        // Collision with player
        const dx = b.x - player.current.x;
        const dy = b.y - player.current.y;
        const dist = Math.hypot(dx, dy);
        if (dist < player.current.width / 2 + b.width / 2 - 8) {
          if (dashInvuln.current > 0) {
            spawnFloatingText(player.current.x, player.current.y - 26, 'DODGE!', '#38bdf8', 17);
            spawnParticles(player.current.x, player.current.y, '#38bdf8', 10);
          } else if (!godMode.current && !modifiers.godMode) {
            player.current.health -= b.damage;
            player.current.isHit = 0.25;
            screenShake.current = Math.max(screenShake.current, 22);
            spawnShockwave(player.current.x, player.current.y, '#ef4444', 180, 700, 5);
            spawnParticles(b.x, b.y, '#f59e0b', 25);
            spawnFloatingText(player.current.x, player.current.y - 24, `-${b.damage}`, '#f87171', 20);
            triggerImpactFrame(player.current.x, player.current.y, '#ef4444', 0.05, 0.028);
            battleSfxRef.current?.playPlayerHit();
            if (player.current.health <= 0) {
              stopGame('GAME_OVER');
            }
          }
          orbitingBurgers.current.splice(i, 1);
          continue;
        }

        // Out of bounds remove
        if (b.x < -100 || b.x > WORLD_WIDTH + 100 || b.y < -100 || b.y > WORLD_HEIGHT + 100) {
          orbitingBurgers.current.splice(i, 1);
          continue;
        }
      }
    }

    if (modifiers.accurateMode && !pinchTriggered.current && deflectedSalads.current >= 12) {
      pinchTriggered.current = true;
      player.current.health = 1;
      screenShake.current = 60;
      spawnParticles(player.current.x, player.current.y, '#ff0000', 50);
    }

    // CHAOS: Double Speed
    if (modifiers.randomChaos && chaosModifiers.current.doubleSpeed) {
      dt *= 2;
    }

    cinematicTimer.current += dt;

    if (modifiers.hardMode) {
      // Hard mode "SUFFER" effect every 12s - clears healthy food
      if (Math.floor(cinematicTimer.current / 12) > Math.floor((cinematicTimer.current - dt) / 12)) {
        projectiles.current = projectiles.current.filter(p => !p.isHealthy);
        screenShake.current = 60;
      }
    }

    const { width: CANVAS_WIDTH, height: CANVAS_HEIGHT } = dimensionsRef.current;

    if (screenShake.current > 0) {
      screenShake.current -= 20 * dt;
    }

    // Player movement & 3D Head Turning
    let dx = 0;
    let dy = 0;

    if (modifiers.mode3D) {
      if (keys.current['q'] || keys.current['arrowleft']) cameraAngle.current -= 2.2 * dt;
      if (keys.current['e'] || keys.current['arrowright']) cameraAngle.current += 2.2 * dt;

      if (player.current.stunTimer > 0) {
        player.current.stunTimer -= dt;
      } else {
        let fwd = 0;
        let strafe = 0;
        if (keys.current['w'] || keys.current['arrowup']) fwd += 1;
        if (keys.current['s'] || keys.current['arrowdown']) fwd -= 1;
        if (keys.current['a']) strafe -= 1;
        if (keys.current['d']) strafe += 1;

        if (fwd !== 0 || strafe !== 0) {
          const len = Math.hypot(fwd, strafe);
          fwd /= len;
          strafe /= len;

          const sinA = Math.sin(cameraAngle.current);
          const cosA = Math.cos(cameraAngle.current);

          dx = sinA * fwd + cosA * strafe;
          dy = -cosA * fwd + sinA * strafe;
        }
      }
    } else {
      if (player.current.stunTimer > 0) {
        player.current.stunTimer -= dt;
      } else {
        if (keys.current['w'] || keys.current['arrowup']) dy -= 1;
        if (keys.current['s'] || keys.current['arrowdown']) dy += 1;
        if (keys.current['a'] || keys.current['arrowleft']) dx -= 1;
        if (keys.current['d'] || keys.current['arrowright']) dx += 1;
      }

      if (dx !== 0 && dy !== 0) {
        const length = Math.sqrt(dx * dx + dy * dy);
        dx /= length;
        dy /= length;
      }
    }

    // Ability, Combo & Screen Flash Timers
    if (dashCooldown.current > 0) dashCooldown.current = Math.max(0, dashCooldown.current - dt);
    if (pulseCooldown.current > 0) pulseCooldown.current = Math.max(0, pulseCooldown.current - dt);
    if (dashInvuln.current > 0) dashInvuln.current = Math.max(0, dashInvuln.current - dt);
    if (parryFlash.current > 0) parryFlash.current = Math.max(0, parryFlash.current - dt);
    if (bossHitFlash.current > 0) bossHitFlash.current = Math.max(0, bossHitFlash.current - dt);
    if (comboTimer.current > 0) {
      comboTimer.current -= dt;
      if (comboTimer.current <= 0) {
        comboCount.current = 0;
      }
    }
    for (let i = dashGhosts.current.length - 1; i >= 0; i--) {
      dashGhosts.current[i].life -= dt;
      if (dashGhosts.current[i].life <= 0) {
        dashGhosts.current.splice(i, 1);
      }
    }

    if (isControllingBoss.current) {
      // Boss control movement
      boss.current.x += dx * player.current.speed * dt;
      boss.current.y += dy * player.current.speed * dt;
      // Player follows boss or stays put? Let's make player follow boss for convenience
      player.current.x = boss.current.x;
      player.current.y = boss.current.y;
    } else if (dashTimer.current > 0) {
      dashTimer.current = Math.max(0, dashTimer.current - dt);
      const dashSpeed = 980;
      player.current.x += dashDir.current.x * dashSpeed * dt;
      player.current.y += dashDir.current.y * dashSpeed * dt;
      dashGhosts.current.push({
        x: player.current.x,
        y: player.current.y,
        life: 0.24,
        maxLife: 0.24,
        color: '#38bdf8',
      });
    } else {
      if (modifiers.randomChaos && chaosModifiers.current.lowGravity) {
        // Drifty movement: speed is treated as acceleration
        const friction = 2.0;
        const accel = 1200;
        player.current.vx = (player.current.vx || 0) + dx * accel * dt;
        player.current.vy = (player.current.vy || 0) + dy * accel * dt;
        player.current.vx *= (1 - friction * dt);
        player.current.vy *= (1 - friction * dt);
        player.current.x += player.current.vx * dt;
        player.current.y += player.current.vy * dt;
      } else {
        player.current.x += dx * player.current.speed * dt;
        player.current.y += dy * player.current.speed * dt;
      }
    }

    // Clamp player to world
    player.current.x = Math.max(player.current.width / 2, Math.min(WORLD_WIDTH - player.current.width / 2, player.current.x));
    player.current.y = Math.max(player.current.height / 2, Math.min(WORLD_HEIGHT - player.current.height / 2, player.current.y));

    // Wall collisions for player
    if (modifiers.enhancedMap) {
      walls.current.forEach(w => {
        const px = player.current.x;
        const py = player.current.y;
        const hw = player.current.width / 2;
        const hh = player.current.height / 2;

        if (px + hw > w.x && px - hw < w.x + w.width && py + hh > w.y && py - hh < w.y + w.height) {
          const overlapLeft = (px + hw) - w.x;
          const overlapRight = (w.x + w.width) - (px - hw);
          const overlapTop = (py + hh) - w.y;
          const overlapBottom = (w.y + w.height) - (py - hh);

          const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
          if (minOverlap === overlapLeft) player.current.x -= overlapLeft;
          else if (minOverlap === overlapRight) player.current.x += overlapRight;
          else if (minOverlap === overlapTop) player.current.y -= overlapTop;
          else if (minOverlap === overlapBottom) player.current.y += overlapBottom;
        }
      });
    }

    if (isControllingBoss.current) {
      boss.current.x = player.current.x;
      boss.current.y = player.current.y;
    }

    // Calculate camera position
    const cameraX = Math.max(0, Math.min(WORLD_WIDTH - CANVAS_WIDTH, player.current.x - CANVAS_WIDTH / 2));
    const cameraY = Math.max(0, Math.min(WORLD_HEIGHT - CANVAS_HEIGHT, player.current.y - CANVAS_HEIGHT / 2));

    // Gun Mode shooting
    if (modifiers.gunMode) {
      player.current.attackTimer -= dt;
      if (keys.current[' '] && player.current.attackTimer <= 0) {
        // Shoot toward mouse
        const angle = Math.atan2(mousePos.current.y + cameraY - player.current.y, mousePos.current.x + cameraX - player.current.x);
        const muzzleX = player.current.x + Math.cos(angle) * 26;
        const muzzleY = player.current.y + Math.sin(angle) * 26;
        projectiles.current.push({
          x: muzzleX,
          y: muzzleY,
          vx: Math.cos(angle) * 1080,
          vy: Math.sin(angle) * 1080,
          radius: 10,
          emoji: '🔫',
          isPlayer: true,
          isHealthy: false,
          rotation: angle,
          rotationSpeed: 0,
          trail: [{ x: muzzleX, y: muzzleY }],
        });
        spawnSlashArc(muzzleX, muzzleY, angle, 34, '#38bdf8');
        spawnParticles(muzzleX, muzzleY, '#7dd3fc', 6);
        battleSfxRef.current?.playGunShot();
        player.current.attackTimer = 0.15; // Fire rate
      }
    }

    // Storm logic
    if (modifiers.storm) {
      // Shrink storm
      stormRadius.current = Math.max(300, stormRadius.current - 15 * dt);
      
      // Check if player is outside storm
      const dx = player.current.x - WORLD_WIDTH / 2;
      const dy = player.current.y - WORLD_HEIGHT / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      const isCutsceneActive = helicopter.current.active && helicopter.current.phase && helicopter.current.phase !== 'COMBAT';
      if (dist > stormRadius.current && !isCutsceneActive && dashInvuln.current <= 0) {
        // Damage player
        player.current.health -= 5 * dt;
        player.current.isHit = 0.1;
        if (player.current.health <= 0) {
          stopGame('GAME_OVER');
        }
      }
    }

    // Helicopter Rescue Cutscene Engine
    if (helicopter.current.active) {
      const h = helicopter.current;
      h.cutsceneTimer = (h.cutsceneTimer || 0) + dt;

      if (!h.phase) h.phase = 'APPROACH';

      if (h.phase === 'APPROACH') {
        // Phase 1: Fly in smoothly to hover above the player & extend ladder
        const targetHoverX = player.current.x;
        const targetHoverY = player.current.y - 140;

        h.x += (targetHoverX - h.x) * 4 * dt;
        h.y += (targetHoverY - h.y) * 4 * dt;
        h.rotation = (targetHoverX - h.x) * 0.0015;

        // Unroll rope ladder
        h.ladderLength = Math.min(115, (h.ladderLength || 0) + 140 * dt);

        // Wind dust particles on ground below chopper
        if (Math.random() < 0.4) {
          spawnParticles(h.x + (Math.random() - 0.5) * 100, player.current.y + 10, '#cbd5e1', 1);
        }

        // Freeze player movement during rescue
        player.current.stunTimer = 1.0;

        if (h.cutsceneTimer >= 2.2) {
          h.phase = 'PICKUP';
          h.cutsceneTimer = 0;
        }
      } else if (h.phase === 'PICKUP') {
        // Phase 2: Player climbs ladder to chopper
        const hoverX = player.current.x;
        const hoverY = player.current.y - 140 + Math.sin(performance.now() / 150) * 6;

        h.x += (hoverX - h.x) * 5 * dt;
        h.y += (hoverY - h.y) * 5 * dt;

        // Move player up to ladder handle
        player.current.y += (h.y + 25 - player.current.y) * 5 * dt;
        player.current.x += (h.x - player.current.x) * 6 * dt;
        player.current.stunTimer = 1.0;

        if (h.cutsceneTimer >= 1.6) {
          h.hasPlayer = true;
          h.phase = 'BOMBING_RUN';
          h.cutsceneTimer = 0;
        }
      } else if (h.phase === 'BOMBING_RUN') {
        // Phase 3: Tactical Bombing Run over Gorgotolisis
        const targetX = boss.current.x + Math.sin(h.cutsceneTimer * 3) * 160;
        const targetY = boss.current.y - 240;

        h.x += (targetX - h.x) * 4 * dt;
        h.y += (targetY - h.y) * 4 * dt;
        h.rotation = Math.sin(h.cutsceneTimer * 5) * 0.12;

        // Clamp player to ladder
        player.current.x = h.x;
        player.current.y = h.y + 25;
        player.current.stunTimer = 1.0;

        // Fire barrage of explosive salad bombs down at Gorgotolisis
        const now = performance.now();
        if (!h.lastShot) h.lastShot = 0;
        if (now - h.lastShot > 100) {
          projectiles.current.push({
            x: h.x + (Math.random() - 0.5) * 50,
            y: h.y + 20,
            vx: (boss.current.x - h.x) * 1.5 + (Math.random() - 0.5) * 200,
            vy: 900 + Math.random() * 300,
            radius: 20,
            emoji: '🥗',
            isPlayer: true,
            isHealthy: true,
            rotation: Math.random() * Math.PI,
            rotationSpeed: 15,
          });
          h.lastShot = now;
        }

        // Heavy screen shake and continuous damage to boss
        screenShake.current = 30;
        boss.current.isHit = 0.2;
        boss.current.health = Math.max(0, boss.current.health - (boss.current.maxHealth / 3.2) * dt);

        spawnParticles(
          boss.current.x + (Math.random() - 0.5) * boss.current.width,
          boss.current.y + (Math.random() - 0.5) * boss.current.height,
          Math.random() < 0.5 ? '#ef4444' : '#f59e0b',
          4
        );

        if (h.cutsceneTimer >= 3.6 || boss.current.health <= 0) {
          // Boss super explosion burst!
          boss.current.health = 0;
          for (let i = 0; i < 150; i++) {
            spawnParticles(
              boss.current.x + (Math.random() - 0.5) * 300,
              boss.current.y + (Math.random() - 0.5) * 300,
              ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6'][Math.floor(Math.random() * 4)],
              1
            );
          }
          h.phase = 'ESCAPE';
          h.cutsceneTimer = 0;
          h.crashTimer = 0;
          // 20% CHANCE OF CHOLESTEROL & CALORIES BEAM AMBUSH
          h.isAmbushed = Math.random() < 0.20;
          if (h.isAmbushed) {
            boss.current.state = 'RAGE';
            boss.current.corruption = 1000;
          }
        }
      } else if (h.phase === 'ESCAPE') {
        if (!h.isAmbushed) {
          // Normal Phase 4: Rocket away off-screen into the sky
          h.rotation = -0.35;
          h.x += 1000 * dt;
          h.y -= (modifiers.mode3D ? 1500 : 750) * dt;

          player.current.x = h.x;
          player.current.y = h.y + 25;

          // After flying off screen, guarantee victory!
          if (h.cutsceneTimer >= 2.0 && !isRescueEnding.current) {
            isRescueEnding.current = true;
            h.active = false;
            h.phase = 'FINISHED';
            stopGame('VICTORY');
          }
        } else if (modifiers.gorgotastic) {
          // Gorgotastic Mode: Ambush is GUARANTEED if helicopter appears, but we disable heli?
          // The user requested: "no helicopter". Let's prevent helicopter from appearing entirely.
          h.active = false;
          h.phase = 'FINISHED';
          stopGame('GAME_OVER');
        } else {
          // 20% AMBUSH: Gorgotolisis reawakens and fires the Cholesterol & Calorie Hyper-Beam!
          h.rotation = -0.35;
          h.x += 650 * dt;
          h.y -= 480 * dt;

          player.current.x = h.x;
          player.current.y = h.y + 25;

          // Gorgotolisis rears up and aims at the escaping helicopter
          boss.current.direction = Math.atan2(h.y - boss.current.y, h.x - boss.current.x);

          // Calorie energy sparks gathering before blast
          if (Math.random() < 0.7) {
            spawnParticles(
              boss.current.x + (Math.random() - 0.5) * 120,
              boss.current.y - 20,
              '#f59e0b',
              2
            );
          }

          // At cutsceneTimer >= 0.7s, the cholesterol beam directly impacts the helicopter!
          if (h.cutsceneTimer >= 0.7) {
            h.phase = 'CRASHING';
            h.crashTimer = 0;
            h.vx = 240;
            h.vy = 220;
            screenShake.current = 70;
            for (let i = 0; i < 40; i++) {
              spawnParticles(h.x, h.y, Math.random() < 0.5 ? '#f59e0b' : '#ef4444', 3);
            }
          }
        }
      } else if (h.phase === 'CRASHING') {
        // Helicopter blasted by beam of cholesterol and calories, spiraling down into a crash!
        h.crashTimer = (h.crashTimer || 0) + dt;
        h.rotation += 14 * dt; // Violent death spin
        h.vy = (h.vy || 220) + 1200 * dt; // Rapid plummeting
        h.vx = (h.vx || 240) * 0.99;
        h.x += h.vx * dt;
        h.y += h.vy * dt;

        player.current.x = h.x;
        player.current.y = h.y + 25;

        screenShake.current = Math.max(screenShake.current, 40);

        // Black smoke and grease fire trails
        spawnParticles(h.x, h.y, Math.random() < 0.5 ? '#1e293b' : '#f59e0b', 4);

        // Junk food pieces exploding off the stricken helicopter
        if (Math.random() < 0.45) {
          projectiles.current.push({
            x: h.x,
            y: h.y,
            vx: (Math.random() - 0.5) * 600,
            vy: (Math.random() - 0.5) * 600,
            radius: 20,
            emoji: JUNK_FOODS[Math.floor(Math.random() * JUNK_FOODS.length)],
            isPlayer: false,
            isHealthy: false,
            rotation: 0,
            rotationSpeed: 12,
          });
        }

        // Catastrophic ground impact crash -> INSTANT KILL!
        if (h.crashTimer >= 1.8 || h.y >= WORLD_HEIGHT / 2 + 350) {
          for (let i = 0; i < 220; i++) {
            spawnParticles(
              h.x + (Math.random() - 0.5) * 450,
              h.y + (Math.random() - 0.5) * 350,
              ['#ef4444', '#f59e0b', '#7c2d12', '#000000'][Math.floor(Math.random() * 4)],
              2
            );
          }
          screenShake.current = 90;
          player.current.health = 0;
          h.active = false;
          h.phase = 'FINISHED';
          setDeathCause('CHOLESTEROL_BEAM');
          stopGame('GAME_OVER');
        }
      } else if (h.phase === 'COMBAT') {
        // Accurate Mode: Cartman as combat companion
        h.targetX = player.current.x;
        h.targetY = player.current.y - 150;

        const dx = h.targetX - h.x;
        const dy = h.targetY - h.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 10) {
          h.x += (dx / dist) * h.speed * dt;
          h.y += (dy / dist) * h.speed * dt;
        }

        const now = performance.now();
        if (!h.lastShot) h.lastShot = 0;
        if (now - h.lastShot > 150) {
          const bulletAngle = Math.atan2(boss.current.y - h.y, boss.current.x - h.x);
          projectiles.current.push({
            x: h.x,
            y: h.y,
            vx: Math.cos(bulletAngle) * 1200,
            vy: Math.sin(bulletAngle) * 1200,
            radius: 12,
            emoji: '🥗',
            isPlayer: true,
            isHealthy: true,
            rotation: 0,
            rotationSpeed: 20
          });
          h.lastShot = now;
        }
      }
    }

    // 22-Second Stratospheric Rotisserie Drop Entrance Cutscene
    fightTimer.current += dt;
    if (entranceCutscene.current.active) {
      const ec = entranceCutscene.current;
      const safeDt = Math.min(dt, 0.05);
      ec.timer += safeDt;
      fightTimer.current = ec.timer;

      const progress = Math.min(1.0, ec.timer / ec.duration);
      const startY = WORLD_HEIGHT / 2 - 1400;
      const targetY = WORLD_HEIGHT / 2 - 300;
      boss.current.y = startY + (targetY - startY) * progress;
      boss.current.x = WORLD_WIDTH / 2 + Math.sin(ec.timer * 1.5) * 50;

      // Scroll clouds & wind streaks upward (falling camera sensation)
      ec.clouds.forEach(c => {
        c.y -= c.speed * safeDt;
        if (c.y < -0.15) {
          c.y = 1.15;
          c.x = Math.random();
        }
      });
      ec.windStreaks.forEach(w => {
        w.y -= w.speed * safeDt;
        if (w.y < -0.2) {
          w.y = 1.2;
          w.x = Math.random();
        }
      });
      ec.greaseSparks.forEach(g => {
        g.x += g.vx * safeDt;
        g.y += g.vy * safeDt;
        if (g.y < -0.1 || g.x < -0.1 || g.x > 1.1) {
          g.x = 0.5 + (Math.random() - 0.5) * 0.22;
          g.y = 0.52 + (Math.random() - 0.5) * 0.14;
        }
      });

      // Touchdown impact at 18.5s (keeps boss music running)
      if (ec.timer >= 18.5 && !ec.impactFired) {
        ec.impactFired = true;
        try {
          const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioCtx) {
            const actx = new AudioCtx();
            const osc = actx.createOscillator();
            const gain = actx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, actx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(28, actx.currentTime + 1.2);
            gain.gain.setValueAtTime(0.22, actx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 1.2);
            osc.connect(gain);
            gain.connect(actx.destination);
            osc.start();
            osc.stop(actx.currentTime + 1.25);
            setTimeout(() => { actx.close().catch(() => {}); }, 1500);
          }
        } catch {
          // Optional impact sound
        }
      }

      if (ec.timer >= ec.duration) {
        finishEntranceCutscene(false);
      }
      return;
    }

    if (boss.current.state === 'ENTRANCE_CHICKEN') {
      const progress = Math.min(1.0, fightTimer.current / 22.0);
      const startY = WORLD_HEIGHT / 2 - 1400;
      const targetY = WORLD_HEIGHT / 2 - 300;

      boss.current.y = startY + (targetY - startY) * progress;
      boss.current.x = WORLD_WIDTH / 2 + Math.sin(fightTimer.current * 1.5) * 50;

      if (Math.random() < 0.4) {
        spawnParticles(
          boss.current.x + (Math.random() - 0.5) * 120,
          boss.current.y + 40,
          '#f59e0b',
          2
        );
      }

      if (fightTimer.current >= 22.0 || progress >= 1.0) {
        boss.current.state = 'NORMAL';
        boss.current.y = targetY;
        screenShake.current = 65;
        spawnShockwave(boss.current.x, targetY, '#fbbf24', 700, 1200, 10);
        spawnShockwave(boss.current.x, targetY, '#f59e0b', 450, 800, 6);
        for (let i = 0; i < 100; i++) {
          spawnParticles(
            boss.current.x + (Math.random() - 0.5) * 200,
            boss.current.y + (Math.random() - 0.5) * 100,
            '#f59e0b',
            1
          );
        }
      }
    }

    // Boss movement & State Machine
    const corruptionFactor = boss.current.corruption / 1000;

    if (modifiers.bigMode) {
      boss.current.width = 400;
      boss.current.height = 400;
      
      // Step earthquake
      boss.current.stepTimer = (boss.current.stepTimer || 0) - dt;
      if (boss.current.stepTimer <= 0) {
        screenShake.current = 15;
        boss.current.stepTimer = 0.8; // Every step
      }

      // Soda blaster trigger if mad (high I-Ready score)
      if (boss.current.corruption >= 7000 && boss.current.state !== 'SODA_BLAST' && !isOnMoon.current) {
        boss.current.state = 'SODA_BLAST';
        boss.current.slamTimer = 6;
        boss.current.attackTimer = 0;
      }
    }

    // B Winger I-Ready Test decay
    if (modifiers.bWinger) {
      boss.current.corruption = Math.max(0, boss.current.corruption - 100 * dt); // 1% of 10000 per second
    } else if (modifiers.gorgotastic) {
      // Gorgotastic Mode: I-Ready Test score grows MUCH faster! (10x faster)
      boss.current.corruption = Math.min(10000, boss.current.corruption + 1000 * dt); 
    }

    if (modifiers.nutritionBalanceMode) {
      // Natural drift towards 0
      if (balanceLevel.current > 0) balanceLevel.current = Math.max(0, balanceLevel.current - 10 * dt);
      if (balanceLevel.current < 0) balanceLevel.current = Math.min(0, balanceLevel.current + 10 * dt);

      // Malnutrition damage if unbalanced
      if (Math.abs(balanceLevel.current) > 80) {
        player.current.health -= 5 * dt;
        if (Math.floor(performance.now() / 200) % 2 === 0) {
          spawnParticles(player.current.x, player.current.y, balanceLevel.current > 0 ? '#4ade80' : '#ef4444', 1);
        }
        if (player.current.health <= 0) stopGame('GAME_OVER');
      }
    }
    
    if (boss.current.corruption >= 5000 && !hasTriggeredCartman.current && !isControllingBoss.current && !modifiers.monkCartmanMode) {
      hasTriggeredCartman.current = true;
      setDialogueMode('CARTMAN');
      setDialogueIndex(0);
      setGameState('DIALOGUE');
      return;
    }

    if (isControllingBoss.current) {
      // Manual boss attacks
      if (keys.current['1']) boss.current.state = 'NORMAL';
      if (keys.current['2']) {
        boss.current.state = 'SLAMMING';
        boss.current.x = player.current.x;
        boss.current.y = cameraY - boss.current.height - 40;
        boss.current.slamTimer = 4;
      }
      if (keys.current['3']) boss.current.state = 'OATMEAL_WALL';
      if (keys.current['4']) boss.current.state = 'CHEF_SPIN';
      if (keys.current['5']) boss.current.state = 'SUMMONING_DONGFISH';
      if (keys.current['6']) boss.current.state = 'OREO_SANDWICH';
      if (keys.current['7']) boss.current.state = 'ULTIMATE_SPAM';
      if (keys.current['8']) boss.current.state = 'CHERRY_CHARGE';
      if (keys.current['9']) boss.current.state = 'SMASH_2';
      
      // Auto-shoot in normal state if mouse is down
      if (boss.current.state === 'NORMAL') {
        boss.current.attackTimer -= dt;
        if (boss.current.attackTimer <= 0 && isMouseDown.current) {
          const angle = Math.atan2(mousePos.current.y + cameraY - boss.current.y, mousePos.current.x + cameraX - boss.current.x);
          const numProjectiles = 3 + Math.floor(corruptionFactor * 6);
          for (let i = 0; i < numProjectiles; i++) {
            const spreadOffset = (i - Math.floor(numProjectiles / 2)) * 0.15;
            const spreadAngle = angle + spreadOffset;
            const isHealthy = modifiers.saladOnly || Math.random() < 0.1;
            projectiles.current.push({
              x: boss.current.x,
              y: boss.current.y,
              vx: Math.cos(spreadAngle) * 500 * projectileSpeedMult.current,
              vy: Math.sin(spreadAngle) * 500 * projectileSpeedMult.current,
              radius: 20,
              emoji: isHealthy ? HEALTHY_FOODS[Math.floor(Math.random() * HEALTHY_FOODS.length)] : JUNK_FOODS[Math.floor(Math.random() * JUNK_FOODS.length)],
              isPlayer: false,
              isHealthy: isHealthy,
              rotation: 0,
              rotationSpeed: (Math.random() - 0.5) * 8,
            });
          }
          boss.current.attackTimer = 0.2;
        }
      }
    } else if (isBossFrozen.current) {
      // Boss is frozen, do nothing
    } else if (boss.current.state === 'NORMAL') {
      // Follow the player - constant speed
      let currentSpeed = boss.current.speed;
      if (modifiers.hardMode) currentSpeed *= 1.6;

      const angleToPlayer = Math.atan2(player.current.y - boss.current.y, player.current.x - boss.current.x);
      
      let moveDirX = Math.cos(angleToPlayer);
      let moveDirY = Math.sin(angleToPlayer);

      // Dodging in Hard Mode
      if (modifiers.hardMode) {
        projectiles.current.forEach(p => {
          if (p.isPlayer || p.isHealthy) {
            const distSq = (p.x - boss.current.x) ** 2 + (p.y - boss.current.y) ** 2;
            if (distSq < 160000) { // 400px range
              const projAngle = Math.atan2(p.vy, p.vx);
              moveDirX += Math.cos(projAngle + Math.PI / 2) * 6;
              moveDirY += Math.sin(projAngle + Math.PI / 2) * 6;
            }
          }
        });
        
        // Normalize again after dodging logic
        const mag = Math.sqrt(moveDirX * moveDirX + moveDirY * moveDirY);
        if (mag > 0) {
          moveDirX /= mag;
          moveDirY /= mag;
        }
      }

      boss.current.x += moveDirX * currentSpeed * dt;
      boss.current.y += moveDirY * currentSpeed * dt;

      // Monk Cartman Boss Swaying
      if (modifiers.monkCartmanMode) {
        boss.current.x += Math.sin(performance.now() / 200) * 100 * dt;
        boss.current.y += Math.cos(performance.now() / 400) * 50 * dt;
      }

      // Boss shooting - amount scales with corruption, but frequency stays constant
      boss.current.attackTimer -= dt;
      if (boss.current.attackTimer <= 0) {
        let angle = Math.atan2(player.current.y - boss.current.y, player.current.x - boss.current.x);
        
        // B Winger miss logic
        if (modifiers.bWinger) {
          angle += (Math.random() - 0.5) * 0.8; // Add significant inaccuracy
        }

        const isEasy = modifiers.superEasy;
        const numProjectiles = (3 + Math.floor(corruptionFactor * 6) + Math.floor(Math.random() * 2));
        
        if (modifiers.breakingPoint) {
          // Breaking Point Attack 1: Stream of glowing white pellets (+ 15% grabbable salads)
          const bulletAngle = angle + (Math.random() - 0.5) * 0.25;
          const isHealthy = Math.random() < 0.15;
          
          projectiles.current.push({
            x: boss.current.x,
            y: boss.current.y,
            vx: Math.cos(bulletAngle) * 950,
            vy: Math.sin(bulletAngle) * 950,
            radius: isHealthy ? 22 : 12,
            emoji: isHealthy ? '🥗' : '⚪',
            isPlayer: false,
            isHealthy: isHealthy,
            isWhitePellet: !isHealthy,
            rotation: 0,
            rotationSpeed: isHealthy ? 6 : 0,
          });
          boss.current.attackTimer = 0.12; // Fast stream of pellets
        } else if (modifiers.monkCartmanMode) {
          // Monk Cartman Bullet Logic - Rapid Fire with Grabbable Salads
          const bulletAngle = angle + (Math.random() - 0.5) * 0.1;
          const isHealthy = Math.random() < 0.05; // 5% chance for a grabbable salad
          
          projectiles.current.push({
            x: boss.current.x,
            y: boss.current.y,
            vx: Math.cos(bulletAngle) * 1100,
            vy: Math.sin(bulletAngle) * 1100,
            radius: isHealthy ? 22 : 10,
            emoji: isHealthy ? HEALTHY_FOODS[Math.floor(Math.random() * HEALTHY_FOODS.length)] : '🔥', 
            isPlayer: false,
            isHealthy: isHealthy,
            isMonkBullet: !isHealthy,
            rotation: bulletAngle,
            rotationSpeed: isHealthy ? 5 : 0,
          });
          boss.current.attackTimer = 0.1; // Very fast
        } else {
          for (let i = 0; i < numProjectiles; i++) {
            const spreadOffset = (i - Math.floor(numProjectiles / 2)) * Math.max(0.1, 0.25 - corruptionFactor * 0.01);
            const spreadAngle = angle + spreadOffset;
            
            let isHealthy = Math.random() < Math.max(0.1, 0.2 - corruptionFactor * 0.01); // 10-20% chance for grabbable salads!
            if (modifiers.saladOnly) isHealthy = true;
            if (modifiers.nutritionBalanceMode) isHealthy = Math.random() < 0.5; // Exactly 50/50 balance
            if (modifiers.bWinger) {
              isHealthy = Math.random() < 0.55; // Much higher chance of salads
            }
            
            const isBandAid = !isHealthy && Math.random() < 0.05; // 5% chance if it's not healthy food
            const speed = (isHealthy ? 150 : (350 + Math.random() * 100)) * projectileSpeedMult.current * (isEasy ? 0.5 : 1); // Constant projectile speed
            
            projectiles.current.push({
              x: boss.current.x,
              y: boss.current.y,
              vx: Math.cos(spreadAngle) * speed,
              vy: Math.sin(spreadAngle) * speed,
              radius: 20,
              emoji: isHealthy ? HEALTHY_FOODS[Math.floor(Math.random() * HEALTHY_FOODS.length)] : (isBandAid ? '🩹' : JUNK_FOODS[Math.floor(Math.random() * JUNK_FOODS.length)]),
              isPlayer: false,
              isHealthy: isHealthy,
              isBandAid: isBandAid,
              rotation: 0,
              rotationSpeed: (Math.random() - 0.5) * 8,
            });
          }
          boss.current.attackTimer = 1.0 + Math.random() * 0.5; // Constant frequency
        }
      }

      // State transitions or Sneeze attack
      if (modifiers.breakingPoint) {
        boss.current.slamTimer -= dt;
        if (boss.current.slamTimer <= 0) {
          // Sneezing Attack!
          screenShake.current = 40;
          sneezeTimer.current = 1.4;
          spawnShockwave(boss.current.x, boss.current.y, '#84cc16', 550, 950, 8);
          spawnParticles(boss.current.x, boss.current.y, '#84cc16', 45);
          spawnParticles(boss.current.x, boss.current.y, '#a3e635', 30);
          battleSfxRef.current?.playSneeze();

          const count = 20;
          for (let p = 0; p < count; p++) {
            const ringAngle = (p / count) * Math.PI * 2;
            const isSalad = p % 5 === 0; // 4 salads in the ring
            projectiles.current.push({
              x: boss.current.x,
              y: boss.current.y,
              vx: Math.cos(ringAngle) * 850,
              vy: Math.sin(ringAngle) * 850,
              radius: isSalad ? 22 : 14,
              emoji: isSalad ? '🥗' : '⚪',
              isPlayer: false,
              isHealthy: isSalad,
              isWhitePellet: !isSalad,
              rotation: 0,
              rotationSpeed: isSalad ? 10 : 0,
            });
          }
          boss.current.slamTimer = 3.5;
        }
        boss.current.state = 'NORMAL';
      } else {
        boss.current.slamTimer -= dt;
        if (boss.current.slamTimer <= 0) {
        if (boss.current.phase === 3) {
          if (phase3AttackDeck.current.length === 0) {
            const pool: Boss['state'][] = [
              'MINIGUN_BARRAGE',
              'CALORIE_SPIRAL',
              'MINIGUN_BARRAGE',
              'JUNK_METEOR_SHOWER',
              'GREASE_SUPERNOVA',
              'CALORIE_BLACK_HOLE',
              'SLAMMING',
              'OREO_SANDWICH',
              'CHEF_SPIN',
              'OATMEAL_WALL',
              'CHERRY_CHARGE',
              'SUMMON_GUY',
              'SUMMONING_DONGFISH',
              'SMASH_2',
              'EARTHQUAKE_CRACK',
            ];
            for (let si = pool.length - 1; si > 0; si--) {
              const sj = Math.floor(Math.random() * (si + 1));
              const tmp = pool[si];
              pool[si] = pool[sj];
              pool[sj] = tmp;
            }
            phase3AttackDeck.current = pool;
          }
          boss.current.state = phase3AttackDeck.current.pop() || 'MINIGUN_BARRAGE';
        } else {
        if (boss.current.corruption >= 10000) {
          boss.current.state = 'ULTIMATE_SPAM';
          boss.current.slamTimer = 10;
          boss.current.attackTimer = 0;
          return;
        }

        const availableStates: (Boss['state'])[] = [];
        if (boss.current.corruption >= 1000) availableStates.push('SLAMMING');
        if (boss.current.corruption >= 2000) availableStates.push('OATMEAL_WALL');
        if (boss.current.corruption >= 3000) availableStates.push('CHEF_SPIN');
        if (boss.current.corruption >= 4000) availableStates.push('CHERRY_CHARGE');
        if (boss.current.corruption >= 4500) availableStates.push('SUMMON_GUY');
        if (boss.current.corruption >= 5000) availableStates.push('SUMMONING_DONGFISH');
        if (boss.current.corruption >= 8000) availableStates.push('OREO_SANDWICH');
        
        if (boss.current.corruption >= 6000) availableStates.push('SMASH_2');
        if (modifiers.bigMode) {
          if (boss.current.corruption >= 7000 && !isOnMoon.current) availableStates.push('SODA_BLAST');
        }

        if (modifiers.hardMode) {
          if (boss.current.corruption >= 3000) availableStates.push('EARTHQUAKE_CRACK');
        }
        
        if (modifiers.bWinger) {
          if (Math.random() < 0.4) availableStates.push('DIZZY');
          if (Math.random() < 0.3) availableStates.push('WHEELCHAIR');
        }

        if (modifiers.classicMode) {
          const hpPct = boss.current.health / boss.current.maxHealth;
          if (hpPct > 0.7) {
            if (boss.current.state !== 'NORMAL') boss.current.state = 'NORMAL';
          } else if (hpPct > 0.3) {
            if (!['SLAMMING', 'SUMMONING_DONGFISH', 'EARTHQUAKE_CRACK'].includes(boss.current.state)) {
              boss.current.state = ['SLAMMING', 'SUMMONING_DONGFISH', 'EARTHQUAKE_CRACK'][Math.floor(Math.random() * 3)] as Boss['state'];
            }
          } else {
            if (boss.current.state !== 'ULTIMATE_SPAM') boss.current.state = 'ULTIMATE_SPAM';
          }
        } else if (modifiers.aiMode) {
          if (performance.now() - lastAITick.current > 4000) {
            lastAITick.current = performance.now();
            fetchAIDecision();
          }
          if (aiDecision.current) {
            boss.current.state = aiDecision.current;
            aiDecision.current = '';
          } else if (availableStates.length > 0) {
            boss.current.state = availableStates[Math.floor(Math.random() * availableStates.length)];
          }
        } else {
          boss.current.state = availableStates.length > 0 
            ? availableStates[Math.floor(Math.random() * availableStates.length)]
            : (boss.current.corruption > 5000 ? 'ULTIMATE_SPAM' : 'NORMAL');
        }
        }

        if (boss.current.state === 'MINIGUN_BARRAGE') {
          boss.current.slamTimer = 4.2;
          boss.current.attackTimer = 0;
          minigunAccumulator.current = 0;
          minigunAimAngle.current = Math.atan2(player.current.y - boss.current.y, player.current.x - boss.current.x);
        } else if (boss.current.state === 'CALORIE_SPIRAL') {
          boss.current.slamTimer = 4.0;
          boss.current.attackTimer = 0;
        } else if (boss.current.state === 'JUNK_METEOR_SHOWER') {
          boss.current.slamTimer = 4.2;
          boss.current.attackTimer = 0;
        } else if (boss.current.state === 'GREASE_SUPERNOVA') {
          boss.current.slamTimer = 3.8;
          boss.current.attackTimer = 0;
        } else if (boss.current.state === 'CALORIE_BLACK_HOLE') {
          boss.current.slamTimer = 4.0;
          boss.current.attackTimer = 0;
        } else if (boss.current.state === 'SLAMMING') {
          boss.current.slamTimer = 4;
          boss.current.attackTimer = 0;
          boss.current.x = player.current.x;
          boss.current.y = cameraY - boss.current.height - 40;
        } else if (boss.current.state === 'SUMMONING_DONGFISH') {
          boss.current.slamTimer = 5;
        } else if (boss.current.state === 'EARTHQUAKE_CRACK') {
            boss.current.slamTimer = 4;
            boss.current.attackTimer = 0;
            screenShake.current = 20;
          } else if (boss.current.state === 'OREO_SANDWICH') {
            boss.current.slamTimer = 4;
            boss.current.attackTimer = 0.5;
          } else if (boss.current.state === 'CHEF_SPIN') {
            boss.current.slamTimer = 4;
            boss.current.attackTimer = 0;
          } else if (boss.current.state === 'OATMEAL_WALL') {
            boss.current.slamTimer = 5;
            boss.current.attackTimer = 0.5;
          } else if (boss.current.state === 'CHERRY_CHARGE') {
            boss.current.slamTimer = 4;
            boss.current.attackTimer = 0;
          } else if (boss.current.state === 'DIZZY') {
            boss.current.slamTimer = 3;
            boss.current.attackTimer = 0;
          } else if (boss.current.state === 'WHEELCHAIR') {
            boss.current.slamTimer = 5;
            boss.current.attackTimer = 0;
          } else if (boss.current.state === 'SMASH_2') {
            boss.current.slamTimer = 6;
            boss.current.attackTimer = 0;
            screenShake.current = 20;
        } else if (boss.current.state === 'SODA_BLAST') {
          boss.current.slamTimer = 6;
          boss.current.attackTimer = 0;
        } else {
          boss.current.slamTimer = 5;
        }
      }
    }
  } else if (boss.current.state === 'WHEELCHAIR') {
      boss.current.slamTimer -= dt;
      // Charge at player faster
      const angle = Math.atan2(player.current.y - boss.current.y, player.current.x - boss.current.x);
      const speed = 800 + boss.current.corruption;
      boss.current.x += Math.cos(angle) * speed * dt;
      boss.current.y += Math.sin(angle) * speed * dt;

      // Wheelchair leaves a trail of grabbable salads!
      boss.current.attackTimer -= dt;
      if (boss.current.attackTimer <= 0) {
        projectiles.current.push({
          x: boss.current.x,
          y: boss.current.y,
          vx: (Math.random() - 0.5) * 160,
          vy: (Math.random() - 0.5) * 160,
          radius: 22,
          emoji: '🥗',
          isPlayer: false,
          isHealthy: true,
          rotation: 0,
          rotationSpeed: 6,
        });
        spawnParticles(boss.current.x, boss.current.y, '#334155', 6);
        boss.current.attackTimer = 0.22;
      }
      
      if (boss.current.slamTimer <= 0) {
        boss.current.state = 'NORMAL';
        boss.current.slamTimer = 5;
      }
    } else if (boss.current.state === 'SMASH_2') {
      boss.current.slamTimer -= dt;
      // Earthquake effect
      screenShake.current = 15;
      
      // Spit out chicken and grabbable salads fast
      boss.current.attackTimer -= dt;
      if (boss.current.attackTimer <= 0) {
        const angle = Math.random() * Math.PI * 2;
        const isHealthy = Math.random() < 0.1; // 10% grabbable salads
        projectiles.current.push({
          x: boss.current.x,
          y: boss.current.y,
          vx: Math.cos(angle) * 800,
          vy: Math.sin(angle) * 800,
          radius: isHealthy ? 22 : 20,
          emoji: isHealthy ? HEALTHY_FOODS[Math.floor(Math.random() * HEALTHY_FOODS.length)] : '🍗',
          isPlayer: false,
          isHealthy: isHealthy,
          rotation: 0,
          rotationSpeed: 15,
        });
        boss.current.attackTimer = 0.05; // Very fast
      }
      
      if (boss.current.slamTimer <= 0) {
        boss.current.state = 'NORMAL';
        boss.current.slamTimer = 5;
        screenShake.current = 0;
      }
    } else if (boss.current.state === 'SODA_BLAST') {
      boss.current.slamTimer -= dt;
      // Aim at player
      const angle = Math.atan2(player.current.y - boss.current.y, player.current.x - boss.current.x);
      boss.current.direction = angle;
      
      // Blast soda with grabbable salads
      boss.current.attackTimer -= dt;
      if (boss.current.attackTimer <= 0) {
        projectiles.current.push({
          x: boss.current.x,
          y: boss.current.y,
          vx: Math.cos(angle) * 1500,
          vy: Math.sin(angle) * 1500,
          radius: 60,
          emoji: '🥤',
          isPlayer: false,
          isHealthy: false,
          isSodaBlast: true,
          rotation: 0,
          rotationSpeed: 20,
        });

        // Spawn grabbable salads along soda blast
        if (Math.random() < 0.55) {
          const sideAngle = angle + (Math.random() > 0.5 ? 0.35 : -0.35);
          projectiles.current.push({
            x: boss.current.x,
            y: boss.current.y,
            vx: Math.cos(sideAngle) * 950,
            vy: Math.sin(sideAngle) * 950,
            radius: 22,
            emoji: '🥗',
            isPlayer: false,
            isHealthy: true,
            rotation: 0,
            rotationSpeed: 8,
          });
        }
        boss.current.attackTimer = 0.08;
      }

      if (boss.current.slamTimer <= 0) {
        boss.current.state = 'NORMAL';
        boss.current.slamTimer = 5;
      }
    } else if (boss.current.state === 'EARTHQUAKE_CRACK') {
      // Crack logic
      boss.current.x += (Math.random() - 0.5) * 40;
      boss.current.y += (Math.random() - 0.5) * 40;
      screenShake.current = Math.max(screenShake.current, 25);

      boss.current.attackTimer -= dt;
        if (boss.current.attackTimer <= 0) {
        // Spawn crack projectiles from nearby relative floor with guaranteed salads
        battleSfxRef.current?.playEarthquake();
        for(let i=0; i<6; i++) {
          const crackX = boss.current.x + (Math.random() - 0.5) * 1600;
          const crackY = boss.current.y + (Math.random() - 0.5) * 1600;
          spawnParticles(crackX, crackY, '#7c2d12', 12);
          if (i < 2) {
            spawnGroundMark(crackX, crackY, 70 + Math.random() * 45, 'FISSURE', '#ea580c', 8);
          }
          
          const isHealthy = modifiers.saladOnly || Math.random() < 0.15;
          projectiles.current.push({
            x: crackX,
            y: crackY,
            vx: (Math.random() - 0.5) * 1000,
            vy: -400 - Math.random() * 1000,
            radius: 20,
            emoji: isHealthy ? HEALTHY_FOODS[Math.floor(Math.random() * HEALTHY_FOODS.length)] : JUNK_FOODS[Math.floor(Math.random() * JUNK_FOODS.length)],
            isPlayer: false,
            isHealthy: isHealthy,
            rotation: 0,
            rotationSpeed: Math.random() * 15
          });
        }
        boss.current.attackTimer = 0.15;
      }

      boss.current.slamTimer -= dt;
      if (boss.current.slamTimer <= 0) {
        boss.current.state = 'NORMAL';
        boss.current.slamTimer = 4;
      }
    } else if (boss.current.state === 'DIZZY') {
      boss.current.slamTimer -= dt;
      // Boss spins slowly and drops wobble salads
      boss.current.direction += 5 * dt; 
      boss.current.attackTimer -= dt;
      if (boss.current.attackTimer <= 0) {
        projectiles.current.push({
          x: boss.current.x,
          y: boss.current.y,
          vx: (Math.random() - 0.5) * 160,
          vy: (Math.random() - 0.5) * 160,
          radius: 22,
          emoji: '🥗',
          isPlayer: false,
          isHealthy: true,
          rotation: 0,
          rotationSpeed: 6,
        });
        boss.current.attackTimer = 0.5;
      }
      if (boss.current.slamTimer <= 0) {
        boss.current.state = 'RAGE';
        boss.current.slamTimer = 6; // Rage for 6 seconds
        boss.current.attackTimer = 0;
      }
    } else if (boss.current.state === 'RAGE') {
      boss.current.slamTimer -= dt;
      // Spam Chef Boyardee with grabbable Salads!
      boss.current.attackTimer -= dt;
      if (boss.current.attackTimer <= 0) {
        // Spawn chef projectiles in a circle + grabbable salads (half are salads!)
        const numChefs = 8;
        for (let i = 0; i < numChefs; i++) {
          const angle = (i / numChefs) * Math.PI * 2 + boss.current.direction;
          const isHealthy = i % 2 === 0; // 50% grabbable salads!
          projectiles.current.push({
            x: boss.current.x,
            y: boss.current.y,
            vx: Math.cos(angle) * 400,
            vy: Math.sin(angle) * 400,
            radius: isHealthy ? 22 : 30,
            emoji: isHealthy ? HEALTHY_FOODS[Math.floor(Math.random() * HEALTHY_FOODS.length)] : '👨‍🍳',
            isPlayer: false,
            isHealthy: isHealthy,
            isChef: !isHealthy,
            rotation: 0,
            rotationSpeed: 10,
          });
        }
        boss.current.attackTimer = 0.3;
        boss.current.direction += 0.5; // Rotate the spawn points
      }
      if (boss.current.slamTimer <= 0) {
        boss.current.state = 'NORMAL';
        boss.current.slamTimer = 5;
      }
      } else if (boss.current.state === 'CHERRY_CHARGE') {
      // Charge at player and leave trail + grabbable salads
      const angle = Math.atan2(player.current.y - boss.current.y, player.current.x - boss.current.x);
      const isEasy = modifiers.superEasy;
      const chargeSpeed = (600 + (boss.current.corruption / 2)) * (isEasy ? 0.5 : 1);
      boss.current.x += Math.cos(angle) * chargeSpeed * dt;
      boss.current.y += Math.sin(angle) * chargeSpeed * dt;

      boss.current.attackTimer -= dt;
      if (boss.current.attackTimer <= 0 && !modifiers.classicMode) {
        // Spawn trail with grabbable salads
        const perpAngle = angle + Math.PI / 2;
        const offset = 40;
        
        // Grabbable Salad in center
        projectiles.current.push({
          x: boss.current.x,
          y: boss.current.y,
          vx: (Math.random() - 0.5) * 80,
          vy: (Math.random() - 0.5) * 80,
          radius: 22,
          emoji: '🥗',
          isPlayer: false,
          isHealthy: true,
          rotation: 0,
          rotationSpeed: 6,
        });

        boss.current.attackTimer = 0.1;
      }

      boss.current.slamTimer -= dt;
      if (boss.current.slamTimer <= 0) {
        boss.current.state = 'NORMAL';
        boss.current.slamTimer = 3;
      }
    } else if (boss.current.state === 'ULTIMATE_SPAM') {
      // THE FINAL FORM: Spam everything at once!
      // Boss spins and pulses
      const targetX = player.current.x;
      const targetY = player.current.y - 250;
      boss.current.x += (targetX - boss.current.x) * 3 * dt;
      boss.current.y += (targetY - boss.current.y) * 3 * dt;

      boss.current.attackTimer -= dt;
      if (boss.current.attackTimer <= 0) {
        // 1. Base Projectile Spread (Insane amount with 40% salads)
        const angle = Math.atan2(player.current.y - boss.current.y, player.current.x - boss.current.x);
        const numProjectiles = 15;
        const isEasy = modifiers.superEasy;
        const baseSpeed = isEasy ? 250 : 500;
        for (let i = 0; i < numProjectiles; i++) {
          const spreadOffset = (i - Math.floor(numProjectiles / 2)) * 0.15;
          const spreadAngle = angle + spreadOffset;
          const isHealthy = modifiers.saladOnly || Math.random() < 0.1;
          projectiles.current.push({
            x: boss.current.x,
            y: boss.current.y,
            vx: Math.cos(spreadAngle) * baseSpeed * projectileSpeedMult.current,
            vy: Math.sin(spreadAngle) * baseSpeed * projectileSpeedMult.current,
            radius: 20,
            emoji: isHealthy ? HEALTHY_FOODS[Math.floor(Math.random() * HEALTHY_FOODS.length)] : JUNK_FOODS[Math.floor(Math.random() * JUNK_FOODS.length)],
            isPlayer: false,
            isHealthy: isHealthy,
            rotation: 0,
            rotationSpeed: (Math.random() - 0.5) * 10,
          });
        }

        // 2. Chef Boyardee Cans & Salads
        const numCans = 4;
        const canSpeed = isEasy ? 300 : 600;
        for (let i = 0; i < numCans; i++) {
          const canAngle = (performance.now() / 50) + (i * (Math.PI * 2 / numCans));
          const isHealthy = i % 2 === 1;
          projectiles.current.push({
            x: boss.current.x,
            y: boss.current.y,
            vx: Math.cos(canAngle) * canSpeed * projectileSpeedMult.current,
            vy: Math.sin(canAngle) * canSpeed * projectileSpeedMult.current,
            radius: isHealthy ? 22 : 25,
            emoji: isHealthy ? '🥗' : '🥫',
            isPlayer: false,
            isHealthy: isHealthy,
            isChef: !isHealthy,
            rotation: 0,
            rotationSpeed: 15,
          });
        }

        // 3. Occasional Oatmeal Wall with Salads
        if (Math.random() < 0.3) {
          const wallX = player.current.x + (Math.random() > 0.5 ? 300 : -300);
          const startY = player.current.y - 200;
          for (let i = 0; i < 5; i++) {
            const isHealthy = i % 2 === 0;
            projectiles.current.push({
              x: wallX,
              y: startY + (i * 100),
              vx: 0,
              vy: 0,
              radius: 40,
              emoji: isHealthy ? '🥗' : '🍪',
              isPlayer: false,
              isHealthy: isHealthy,
              isOatmeal: !isHealthy,
              life: 1.0,
              rotation: 0,
              rotationSpeed: 0,
            });
          }
        }

        // 4. Dongfish + Grabbable Salad
        if (Math.random() < 0.2) {
          projectiles.current.push({
            x: boss.current.x,
            y: boss.current.y,
            vx: 0,
            vy: 0,
            radius: 25,
            emoji: '🐟',
            isPlayer: false,
            isHealthy: false,
            isDongfish: true,
            life: 5,
            rotation: 0,
            rotationSpeed: 0,
          });
          projectiles.current.push({
            x: boss.current.x + 35,
            y: boss.current.y,
            vx: (Math.random() - 0.5) * 150,
            vy: 120,
            radius: 22,
            emoji: '🥗',
            isPlayer: false,
            isHealthy: true,
            rotation: 0,
            rotationSpeed: 6,
          });
        }

        // 5. Oreo Halves + Center Salad
        if (Math.random() < 0.1) {
          projectiles.current.push({
            x: cameraX - 50,
            y: player.current.y,
            vx: 800 * projectileSpeedMult.current,
            vy: 0,
            radius: 60,
            emoji: '🍪',
            isPlayer: false,
            isHealthy: false,
            isOreo: true,
            rotation: 0,
            rotationSpeed: 8,
          });
          projectiles.current.push({
            x: cameraX + CANVAS_WIDTH + 50,
            y: player.current.y,
            vx: -800 * projectileSpeedMult.current,
            vy: 0,
            radius: 60,
            emoji: '🍪',
            isPlayer: false,
            isHealthy: false,
            isOreo: true,
            rotation: 0,
            rotationSpeed: -8,
          });
          projectiles.current.push({
            x: player.current.x,
            y: player.current.y,
            vx: 0,
            vy: 0,
            radius: 24,
            emoji: '🥗',
            isPlayer: false,
            isHealthy: true,
            rotation: 0,
            rotationSpeed: 8,
          });
        }

        boss.current.attackTimer = 0.4;
      }

      boss.current.slamTimer -= dt;
      if (boss.current.slamTimer <= 0) {
        // Stay in ultimate spam if still at 1000%
        if (boss.current.corruption < 10000) {
          boss.current.state = 'NORMAL';
          boss.current.slamTimer = 2;
        } else {
          boss.current.slamTimer = 10;
        }
      }
    } else if (boss.current.state === 'OATMEAL_WALL') {
      // Boss moves to a position to watch the wall
      const targetX = cameraX + CANVAS_WIDTH / 2;
      const targetY = cameraY + 100;
      boss.current.x += (targetX - boss.current.x) * 2 * dt;
      boss.current.y += (targetY - boss.current.y) * 2 * dt;

      boss.current.attackTimer -= dt;
      if (boss.current.attackTimer <= 0 && boss.current.slamTimer > 3) {
        // Spawn the wall of oatmeal cream pies with grabbable salads!
        const wallX = player.current.x + 300;
        const startY = player.current.y - 250;
        const numPies = 6 + Math.floor(corruptionFactor * 4);
        
        for (let i = 0; i < numPies; i++) {
          const isHealthy = i % 2 === 0; // Alternating salads!
          projectiles.current.push({
            x: wallX,
            y: startY + (i * 100),
            vx: 0,
            vy: 0,
            radius: 40,
            emoji: isHealthy ? '🥗' : '🍪',
            isPlayer: false,
            isHealthy: isHealthy,
            isOatmeal: !isHealthy,
            life: 1.5, // Time before flinging
            rotation: 0,
            rotationSpeed: 0,
          });
        }
        boss.current.attackTimer = 999; // Only spawn once
      }

      boss.current.slamTimer -= dt;
      if (boss.current.slamTimer <= 0) {
        boss.current.state = 'NORMAL';
        boss.current.slamTimer = 2 + Math.random() * 2;
      }
    } else if (boss.current.state === 'CHEF_SPIN') {
      // Boss spins fast and spits out Chef Boyardee and grabbable salads!
      const targetX = player.current.x;
      const targetY = player.current.y - 200;
      boss.current.x += (targetX - boss.current.x) * 1.5 * dt;
      boss.current.y += (targetY - boss.current.y) * 1.5 * dt;

      boss.current.attackTimer -= dt;
      if (boss.current.attackTimer <= 0) {
        const numCans = 2 + Math.floor(corruptionFactor * 3);
        for (let i = 0; i < numCans; i++) {
          const angle = (performance.now() / 100) + (i * (Math.PI * 2 / numCans));
          const speed = 450;
          const isHealthy = i % 2 === 1; // Alternating grabbable salads!
          projectiles.current.push({
            x: boss.current.x,
            y: boss.current.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: isHealthy ? 22 : 25,
            emoji: isHealthy ? '🥗' : '🥫',
            isPlayer: false,
            isHealthy: isHealthy,
            isChef: !isHealthy,
            rotation: 0,
            rotationSpeed: 10,
          });
        }
        boss.current.attackTimer = 0.2;
      }

      boss.current.slamTimer -= dt;
      if (boss.current.slamTimer <= 0) {
        boss.current.state = 'NORMAL';
        boss.current.slamTimer = 2 + Math.random() * 2;
      }
    } else if (boss.current.state === 'OREO_SANDWICH') {
      // Boss moves to center of screen
      const targetX = cameraX + CANVAS_WIDTH / 2;
      const targetY = cameraY + 150;
      boss.current.x += (targetX - boss.current.x) * 2 * dt;
      boss.current.y += (targetY - boss.current.y) * 2 * dt;

      boss.current.attackTimer -= dt;
      if (boss.current.attackTimer <= 0 && boss.current.slamTimer > 1) {
        // Spawn the two halves
        const spawnX1 = cameraX - 100;
        const spawnX2 = cameraX + CANVAS_WIDTH + 100;
        const spawnY = player.current.y;

        projectiles.current.push({
          x: spawnX1,
          y: spawnY,
          vx: 600,
          vy: 0,
          radius: 80,
          emoji: '🍪',
          isPlayer: false,
          isHealthy: false,
          isOreo: true,
          rotation: 0,
          rotationSpeed: 5,
        });

        projectiles.current.push({
          x: spawnX2,
          y: spawnY,
          vx: -600,
          vy: 0,
          radius: 80,
          emoji: '🍪',
          isPlayer: false,
          isHealthy: false,
          isOreo: true,
          rotation: 0,
          rotationSpeed: -5,
        });

        // Spawn 3 grabbable salads in the middle squeeze corridor!
        for (let s = -1; s <= 1; s++) {
          projectiles.current.push({
            x: player.current.x,
            y: spawnY + s * 65,
            vx: 0,
            vy: 0,
            radius: 24,
            emoji: '🥗',
            isPlayer: false,
            isHealthy: true,
            rotation: 0,
            rotationSpeed: 8,
          });
        }

        boss.current.attackTimer = 999; // Only spawn once per state
      }

      boss.current.slamTimer -= dt;
      if (boss.current.slamTimer <= 0) {
        boss.current.state = 'NORMAL';
        boss.current.slamTimer = 3 + Math.random() * 2;
      }
    } else if (boss.current.state === 'SUMMON_GUY') {
      boss.current.x += (cameraX + CANVAS_WIDTH / 2 - boss.current.x) * 2 * dt;
      boss.current.y += (cameraY + 160 - boss.current.y) * 2 * dt;

      boss.current.attackTimer -= dt;
      if (boss.current.attackTimer <= 0 && boss.current.slamTimer > 1) {
        // Play summon sound effect
        try {
          const summonAudio = new Audio('https://files.catbox.moe/36bo5w.mp3');
          summonAudio.volume = 0.8;
          summonAudio.play().catch(err => console.log("Audio autoplay prevented:", err));
        } catch (e) {
          console.warn("Audio error:", e);
        }

        // Summon the guys around player
        const numGuys = 3 + Math.floor(corruptionFactor * 2);
        for (let i = 0; i < numGuys; i++) {
          const spawnAngle = (i / numGuys) * Math.PI * 2;
          const spawnDist = 200 + Math.random() * 150;
          const guyX = player.current.x + Math.cos(spawnAngle) * spawnDist;
          const guyY = player.current.y + Math.sin(spawnAngle) * spawnDist;

          spawnParticles(guyX, guyY, '#38bdf8', 15);
          
          projectiles.current.push({
            x: guyX,
            y: guyY,
            vx: 0,
            vy: 0,
            radius: 35,
            emoji: '🧑',
            isPlayer: false,
            isHealthy: false,
            isSummonGuy: true,
            life: 2.2, // 2.2 seconds before exploding into chicken
            rotation: 0,
            rotationSpeed: 6,
          });
        }
        boss.current.attackTimer = 999;
      }

      boss.current.slamTimer -= dt;
      if (boss.current.slamTimer <= 0) {
        boss.current.state = 'NORMAL';
        boss.current.slamTimer = 4 + Math.random() * 2;
      }
    } else if (boss.current.state === 'SUMMONING_DONGFISH') {
      boss.current.x += boss.current.speed * boss.current.direction * dt;
      boss.current.y = cameraY + 120 + Math.sin(performance.now() / 500) * 30;

      if (boss.current.x < cameraX + boss.current.width / 2 + 50 || boss.current.x > cameraX + CANVAS_WIDTH - boss.current.width / 2 - 50) {
        boss.current.direction *= -1;
        boss.current.x = Math.max(cameraX + boss.current.width / 2 + 50, Math.min(cameraX + CANVAS_WIDTH - boss.current.width / 2 - 50, boss.current.x));
      }

      // Summon dongfish + Grabbable Salad swimming along!
      boss.current.attackTimer -= dt;
      if (boss.current.attackTimer <= 0) {
        projectiles.current.push({
          x: boss.current.x,
          y: boss.current.y,
          vx: 0,
          vy: 0,
          radius: 25,
          emoji: '🐟',
          isPlayer: false,
          isHealthy: false,
          isDongfish: true,
          life: 10,
          rotation: 0,
          rotationSpeed: 0,
        });
        projectiles.current.push({
          x: boss.current.x + (Math.random() - 0.5) * 80,
          y: boss.current.y + 40,
          vx: (player.current.x - boss.current.x) * 0.35,
          vy: 200,
          radius: 22,
          emoji: '🥗',
          isPlayer: false,
          isHealthy: true,
          rotation: 0,
          rotationSpeed: 7,
        });
        boss.current.attackTimer = 0.8; // Constant summoning speed
      }

      boss.current.slamTimer -= dt;
      if (boss.current.slamTimer <= 0) {
        boss.current.state = 'NORMAL';
        boss.current.slamTimer = 3 + Math.random() * 2;
      }
    } else if (boss.current.state === 'SLAMMING') {
      boss.current.y += 1400 * dt; // Fast meteor plunge fall
      const floorY = cameraY + CANVAS_HEIGHT - boss.current.height / 2;
      if (boss.current.y >= floorY) {
        boss.current.y = floorY;
        boss.current.state = 'RISING';
        boss.current.slamTimer = 3 + Math.random() * 2;
        screenShake.current = 50; // Massive earthquake shockwave
        spawnGroundMark(boss.current.x, floorY + 20, 150, 'CRATER', '#ea580c', 12);
        spawnShockwave(boss.current.x, floorY, '#f59e0b', 650, 1200, 8);
        spawnShockwave(boss.current.x, floorY, '#ef4444', 420, 800, 5);
        battleSfxRef.current?.playBossSlam();
        for (let p = 0; p < 45; p++) {
          spawnParticles(
            boss.current.x + (Math.random() - 0.5) * (boss.current.width + 120),
            floorY + (Math.random() - 0.5) * 30,
            ['#ef4444', '#f59e0b', '#7c2d12', '#fef08a'][Math.floor(Math.random() * 4)],
            2
          );
        }
        
        // Slam impact - spawn junk food and massive salad eruption fountain!
        const numSlamProjectiles = 24 + Math.floor(corruptionFactor * 48);
        for (let i = 0; i < numSlamProjectiles; i++) {
          const isHealthy = modifiers.saladOnly || Math.random() < 0.15; // 15% salads!
          projectiles.current.push({
            x: boss.current.x,
            y: boss.current.y,
            vx: (Math.random() - 0.5) * 1100,
            vy: -250 - Math.random() * 850,
            radius: 20,
            emoji: isHealthy ? HEALTHY_FOODS[Math.floor(Math.random() * HEALTHY_FOODS.length)] : JUNK_FOODS[Math.floor(Math.random() * JUNK_FOODS.length)],
            isPlayer: false,
            isHealthy: isHealthy,
            rotation: 0,
            rotationSpeed: (Math.random() - 0.5) * 15,
          });
        }
      }
    } else if (boss.current.state === 'RISING') {
      boss.current.y -= 250 * dt; // Slower rise
      boss.current.attackTimer -= dt;
      if (boss.current.attackTimer <= 0) {
        projectiles.current.push({
          x: boss.current.x + (Math.random() - 0.5) * 120,
          y: boss.current.y,
          vx: (Math.random() - 0.5) * 120,
          vy: 80,
          radius: 22,
          emoji: '🥗',
          isPlayer: false,
          isHealthy: true,
          rotation: 0,
          rotationSpeed: 6,
        });
        boss.current.attackTimer = 0.4;
      }
      const targetY = cameraY + 120;
      if (boss.current.y <= targetY) {
        boss.current.y = targetY;
        boss.current.state = 'NORMAL';
      }
    } else if (boss.current.state === 'MINIGUN_BARRAGE') {
      // Stage 3 Signature: 6-Barrel Calorie Minigun firing ALL junk food one at a time at 55 rounds/sec!
      const orbitAngle = performance.now() * 0.0012;
      const desiredX = player.current.x + Math.cos(orbitAngle) * 380;
      const desiredY = player.current.y + Math.sin(orbitAngle) * 260;
      boss.current.x += (desiredX - boss.current.x) * 2.4 * dt;
      boss.current.y += (desiredY - boss.current.y) * 2.4 * dt;

      const targetAim = Math.atan2(player.current.y - boss.current.y, player.current.x - boss.current.x);
      let angleDiff = targetAim - minigunAimAngle.current;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      minigunAimAngle.current += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 2.75 * dt);

      const fireInterval = 1 / 55;
      minigunAccumulator.current += dt;
      const maxShotsThisFrame = 4;
      let shotsFired = 0;
      const barrelDist = boss.current.width * 0.68;
      const muzzleX = boss.current.x + Math.cos(minigunAimAngle.current) * barrelDist;
      const muzzleY = boss.current.y + Math.sin(minigunAimAngle.current) * barrelDist;

      while (minigunAccumulator.current >= fireInterval && shotsFired < maxShotsThisFrame) {
        minigunAccumulator.current -= fireInterval;
        shotsFired++;
        minigunShotCount.current++;

        const isSaladRound = modifiers.saladOnly || minigunShotCount.current % 26 === 0;
        const spread = (Math.random() - 0.5) * 0.22;
        const shotAngle = minigunAimAngle.current + spread;
        const speed = (modifiers.superEasy ? 520 : 880) * projectileSpeedMult.current;

        if (isSaladRound) {
          projectiles.current.push({
            x: muzzleX,
            y: muzzleY,
            vx: Math.cos(shotAngle) * (speed * 0.78),
            vy: Math.sin(shotAngle) * (speed * 0.78),
            radius: 22,
            emoji: '🥗',
            isPlayer: false,
            isHealthy: true,
            isMinigun: true,
            rotation: 0,
            rotationSpeed: 8,
          });
        } else {
          const foodIdx = minigunFoodIndex.current % 14;
          minigunFoodIndex.current++;
          spawnJunkFoodItem(
            muzzleX,
            muzzleY,
            Math.cos(shotAngle) * speed,
            Math.sin(shotAngle) * speed,
            foodIdx,
            undefined,
            true
          );
        }
      }

      if (shotsFired > 0) {
        battleSfxRef.current?.playMinigunShot();
        screenShake.current = Math.max(screenShake.current, 5);
        if (Math.random() < 0.65) {
          spawnParticles(muzzleX, muzzleY, Math.random() < 0.5 ? '#fbbf24' : '#ef4444', 1);
        }
      }

      // Trim oldest enemy minigun bullets if density exceeds 420 to keep 60fps locked
      if (projectiles.current.length > 420) {
        let toDrop = projectiles.current.length - 420;
        for (let pi = 0; pi < projectiles.current.length && toDrop > 0; pi++) {
          if (!projectiles.current[pi].isPlayer && !projectiles.current[pi].isHealthy) {
            projectiles.current.splice(pi, 1);
            pi--;
            toDrop--;
          }
        }
      }

      boss.current.slamTimer -= dt;
      if (boss.current.slamTimer <= 0) {
        boss.current.state = 'NORMAL';
        boss.current.slamTimer = 1.6 + Math.random() * 0.8;
      }
    } else if (boss.current.state === 'CALORIE_SPIRAL') {
      // Multi-arm rotating galaxy spiral cycling all junk food + salads
      const centerX = player.current.x;
      const centerY = player.current.y - 260;
      boss.current.x += (centerX - boss.current.x) * 2.5 * dt;
      boss.current.y += (centerY - boss.current.y) * 2.5 * dt;

      boss.current.attackTimer -= dt;
      if (boss.current.attackTimer <= 0) {
        const arms = 6;
        const spin = performance.now() * 0.0045;
        const speed = (modifiers.superEasy ? 320 : 540) * projectileSpeedMult.current;
        for (let a = 0; a < arms; a++) {
          const ang = spin + (a / arms) * Math.PI * 2;
          if (a === 0 && Math.random() < 0.45) {
            projectiles.current.push({
              x: boss.current.x,
              y: boss.current.y,
              vx: Math.cos(ang) * speed * 0.85,
              vy: Math.sin(ang) * speed * 0.85,
              radius: 22,
              emoji: '🥗',
              isPlayer: false,
              isHealthy: true,
              rotation: 0,
              rotationSpeed: 7,
            });
          } else {
            spawnJunkFoodItem(
              boss.current.x,
              boss.current.y,
              Math.cos(ang) * speed,
              Math.sin(ang) * speed,
              minigunFoodIndex.current++,
              19,
              true
            );
          }
        }
        boss.current.attackTimer = 0.13;
      }

      boss.current.slamTimer -= dt;
      if (boss.current.slamTimer <= 0) {
        boss.current.state = 'NORMAL';
        boss.current.slamTimer = 1.8;
      }
    } else if (boss.current.state === 'JUNK_METEOR_SHOWER') {
      // Heavy artillery rain of giant Oreos, Chef cans, Oatmeal pies, Big Macs & salads
      const targetX = player.current.x;
      const targetY = cameraY + 120;
      boss.current.x += (targetX - boss.current.x) * 2.5 * dt;
      boss.current.y += (targetY - boss.current.y) * 2.5 * dt;

      boss.current.attackTimer -= dt;
      if (boss.current.attackTimer <= 0) {
        const meteorCount = 3;
        for (let m = 0; m < meteorCount; m++) {
          const dropX = player.current.x + (Math.random() - 0.5) * 950;
          const dropY = cameraY - 40 - Math.random() * 80;
          const isSalad = modifiers.saladOnly || Math.random() < 0.18;
          if (isSalad) {
            projectiles.current.push({
              x: dropX,
              y: dropY,
              vx: (Math.random() - 0.5) * 140,
              vy: 420,
              radius: 23,
              emoji: '🥗',
              isPlayer: false,
              isHealthy: true,
              rotation: 0,
              rotationSpeed: 6,
            });
          } else {
            const heavyCatalog = [7, 8, 9, 11, 12, 13];
            const choice = heavyCatalog[Math.floor(Math.random() * heavyCatalog.length)];
            spawnJunkFoodItem(
              dropX,
              dropY,
              (Math.random() - 0.5) * 200,
              (modifiers.superEasy ? 440 : 720) * projectileSpeedMult.current,
              choice,
              28,
              true
            );
          }
        }
        screenShake.current = Math.max(screenShake.current, 8);
        boss.current.attackTimer = 0.22;
      }

      boss.current.slamTimer -= dt;
      if (boss.current.slamTimer <= 0) {
        boss.current.state = 'NORMAL';
        boss.current.slamTimer = 1.6;
      }
    } else if (boss.current.state === 'GREASE_SUPERNOVA') {
      // Expanding concentric 360° nova bursts of mixed junk food & salads
      const targetX = cameraX + CANVAS_WIDTH / 2;
      const targetY = cameraY + CANVAS_HEIGHT * 0.35;
      boss.current.x += (targetX - boss.current.x) * 3 * dt;
      boss.current.y += (targetY - boss.current.y) * 3 * dt;

      boss.current.attackTimer -= dt;
      if (boss.current.attackTimer <= 0) {
        const ringCount = 18;
        const baseRot = Math.random() * Math.PI * 2;
        const speed = (modifiers.superEasy ? 340 : 620) * projectileSpeedMult.current;
        spawnShockwave(boss.current.x, boss.current.y, '#a855f7', 420, 950, 7);
        for (let r = 0; r < ringCount; r++) {
          const ang = baseRot + (r / ringCount) * Math.PI * 2;
          const isHealthy = modifiers.saladOnly || r % 6 === 0;
          if (isHealthy) {
            projectiles.current.push({
              x: boss.current.x,
              y: boss.current.y,
              vx: Math.cos(ang) * speed * 0.85,
              vy: Math.sin(ang) * speed * 0.85,
              radius: 22,
              emoji: '🥗',
              isPlayer: false,
              isHealthy: true,
              rotation: 0,
              rotationSpeed: 7,
            });
          } else {
            spawnJunkFoodItem(
              boss.current.x,
              boss.current.y,
              Math.cos(ang) * speed,
              Math.sin(ang) * speed,
              r + minigunFoodIndex.current,
              20,
              true
            );
          }
        }
        minigunFoodIndex.current += 3;
        screenShake.current = Math.max(screenShake.current, 16);
        boss.current.attackTimer = 0.65;
      }

      boss.current.slamTimer -= dt;
      if (boss.current.slamTimer <= 0) {
        boss.current.state = 'NORMAL';
        boss.current.slamTimer = 1.6;
      }
    } else if (boss.current.state === 'CALORIE_BLACK_HOLE') {
      // Gravitational vacuum pull followed by high-velocity food eruption
      const pullDx = boss.current.x - player.current.x;
      const pullDy = boss.current.y - player.current.y;
      const pullDist = Math.max(40, Math.hypot(pullDx, pullDy));
      if (dashInvuln.current <= 0) {
        player.current.x += (pullDx / pullDist) * 195 * dt;
        player.current.y += (pullDy / pullDist) * 195 * dt;
      }

      boss.current.attackTimer -= dt;
      if (boss.current.attackTimer <= 0) {
        const count = 8;
        const rotOffset = performance.now() * 0.003;
        const speed = (modifiers.superEasy ? 360 : 660) * projectileSpeedMult.current;
        for (let k = 0; k < count; k++) {
          const ang = rotOffset + (k / count) * Math.PI * 2;
          if (k === 0) {
            projectiles.current.push({
              x: boss.current.x,
              y: boss.current.y,
              vx: Math.cos(ang) * speed * 0.75,
              vy: Math.sin(ang) * speed * 0.75,
              radius: 22,
              emoji: '🥗',
              isPlayer: false,
              isHealthy: true,
              rotation: 0,
              rotationSpeed: 6,
            });
          } else {
            spawnJunkFoodItem(
              boss.current.x,
              boss.current.y,
              Math.cos(ang) * speed,
              Math.sin(ang) * speed,
              minigunFoodIndex.current++,
              19,
              true
            );
          }
        }
        spawnShockwave(boss.current.x, boss.current.y, '#ef4444', 320, 800, 5);
        boss.current.attackTimer = 0.28;
      }

      boss.current.slamTimer -= dt;
      if (boss.current.slamTimer <= 0) {
        boss.current.state = 'NORMAL';
        boss.current.slamTimer = 1.6;
      }
    }

    // Player-Boss collision (hitbox)
    const bdx = player.current.x - boss.current.x;
    const bdy = player.current.y - boss.current.y;
    const bdist = Math.sqrt(bdx * bdx + bdy * bdy);
    if (bdist < (player.current.width / 2 + boss.current.width / 2.5)) {
      const isCutsceneActive = helicopter.current.active && helicopter.current.phase && helicopter.current.phase !== 'COMBAT';
      if (!godMode.current && !modifiers.godMode && !isCutsceneActive && dashInvuln.current <= 0) {
        const damage = (modifiers.superEasy ? 10 : 40);
        player.current.health -= damage * dt; // Continuous damage if touching
        if (player.current.isHit <= 0) {
          triggerImpactFrame(player.current.x, player.current.y, '#ef4444', 0.045, 0.022);
        }
        player.current.isHit = 0.1;
        battleSfxRef.current?.playPlayerHit();
        if (player.current.health <= 0) {
          stopGame('GAME_OVER');
        }
      }
    }

    // Boss health regen
    if (boss.current.health > 0 && boss.current.health < boss.current.maxHealth) {
      boss.current.health = Math.min(boss.current.maxHealth, boss.current.health + boss.current.regenRate * dt);
    }
    
    // Player health regen
    if (player.current.health > 0 && player.current.health < player.current.maxHealth && !godMode.current && !modifiers.godMode) {
      const upgRegen = profile?.upgrades?.healthRegen || 0;
      if (upgRegen > 0) {
        player.current.health = Math.min(player.current.maxHealth, player.current.health + (upgRegen * dt));
      }
    }

    // Black Hole Core Pull
    if (modifiers.blackHoleCore) {
      const centerX = WORLD_WIDTH / 2;
      const centerY = WORLD_HEIGHT / 2;
      
      // Pull player
      const pDx = centerX - player.current.x;
      const pDy = centerY - player.current.y;
      const pDist = Math.max(10, Math.sqrt(pDx * pDx + pDy * pDy));
      
      // Distance-based pull: gets linearly stronger as you approach center
      // Max pull is 320 (less than base player speed of 350) to allow escape
      const maxPPull = 320;
      const pullRange = 1800;
      const pPullForce = Math.max(0, (1 - pDist / pullRange) * maxPPull);
      
      player.current.x += (pDx / pDist) * pPullForce * dt;
      player.current.y += (pDy / pDist) * pPullForce * dt;

      // Pull boss
      const bDx = centerX - boss.current.x;
      const bDy = centerY - boss.current.y;
      const bDist = Math.max(10, Math.sqrt(bDx * bDx + bDy * bDy));
      const bPullForce = Math.max(0, (1 - bDist / pullRange) * 200);
      boss.current.x += (bDx / bDist) * bPullForce * dt;
      boss.current.y += (bDy / bDist) * bPullForce * dt;
    }

    // Update projectiles
    for (let i = projectiles.current.length - 1; i >= 0; i--) {
      const p = projectiles.current[i];
      if (!p) continue;
      
      // Black Hole Pull on projectiles
      if (modifiers.blackHoleCore) {
        const centerX = WORLD_WIDTH / 2;
        const centerY = WORLD_HEIGHT / 2;
        const dx = centerX - p.x;
        const dy = centerY - p.y;
        const dist = Math.max(10, Math.sqrt(dx * dx + dy * dy));
        
        const projPullRange = 1500;
        const projMaxPull = 1200;
        const projPull = Math.max(0, (1 - dist / projPullRange) * projMaxPull);
        
        p.vx += (dx / dist) * projPull * dt;
        p.vy += (dy / dist) * projPull * dt;
      }

      if (p.isOatmeal && p.life !== undefined) {
        p.life -= dt;
        if (p.life <= 0 && p.vx === 0) {
          // Fling toward player
          const angle = Math.atan2(player.current.y - p.y, player.current.x - p.x);
          const speed = (modifiers.superEasy ? 350 : 700);
          p.vx = Math.cos(angle) * speed;
          p.vy = Math.sin(angle) * speed;
          p.rotationSpeed = 10;
        }
      }

      if (p.isSummonGuy && p.life !== undefined) {
        p.life -= dt;
        if (p.life <= 0) {
          // Explode into a shower of chicken (rotisserie chicken + salads)!
          spawnParticles(p.x, p.y, '#f59e0b', 25);
          for (let c = 0; c < 6; c++) {
            const cAngle = (c / 6) * Math.PI * 2;
            const isHealthy = c % 2 === 1;
            projectiles.current.push({
              x: p.x,
              y: p.y,
              vx: Math.cos(cAngle) * 550,
              vy: Math.sin(cAngle) * 550,
              radius: isHealthy ? 22 : 24,
              emoji: isHealthy ? '🥗' : '🍗',
              isPlayer: false,
              isHealthy: isHealthy,
              rotation: 0,
              rotationSpeed: 10,
            });
          }
          // Remove the summon guy projectile
          projectiles.current.splice(i, 1);
          continue;
        }
      }

      if ((p.isCherryCoke || p.isCreamPepsi) && p.homingTimer !== undefined) {
        p.homingTimer -= dt;
        if (p.homingTimer <= 0) {
          // Charge at player
          const angle = Math.atan2(player.current.y - p.y, player.current.x - p.x);
          const speed = (modifiers.superEasy ? 400 : 800);
          p.vx = Math.cos(angle) * speed;
          p.vy = Math.sin(angle) * speed;
          p.homingTimer = 999; // Only trigger once
          p.rotationSpeed = 20;
        }
      }

      if (Math.abs(p.vx) > 3000) p.vx = Math.sign(p.vx) * 3000;
      if (Math.abs(p.vy) > 3000) p.vy = Math.sign(p.vy) * 3000;

      if (Math.abs(p.vx) > 20 || Math.abs(p.vy) > 20) {
        if (!p.trail) p.trail = [];
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 6) p.trail.shift();
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Dimension Tear Teleportation
      if (modifiers.dimensionTear) {
        if (!p.lastTeleport || performance.now() - p.lastTeleport > 500) {
          dimensionTears.current.forEach(tear => {
            const dx = p.x - tear.x;
            const dy = p.y - tear.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < tear.radius / 2) {
              const partner = dimensionTears.current[tear.partnerIndex];
              p.x = partner.x;
              p.y = partner.y;
              p.lastTeleport = performance.now();
              // Add some randomness to velocity to make it interesting
              const angle = Math.atan2(p.vy, p.vx) + (Math.random() - 0.5) * 0.5;
              const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
              p.vx = Math.cos(angle) * speed;
              p.vy = Math.sin(angle) * speed;
            }
          });
        }
      }

      // Wall collision for projectile
      if (modifiers.enhancedMap) {
        let hitWall = false;
        walls.current.forEach(w => {
          if (p.x > w.x && p.x < w.x + w.width && p.y > w.y && p.y < w.y + w.height) {
            hitWall = true;
          }
        });
        if (hitWall) {
          spawnParticles(p.x, p.y, '#64748b', 5);
          projectiles.current.splice(i, 1);
          continue;
        }
      }

      if (!p.isDongfish) {
        p.rotation += p.rotationSpeed * dt;
      }

      // Remove off-screen
      if (p.x < -50 || p.x > WORLD_WIDTH + 50 || p.y < -50 || p.y > WORLD_HEIGHT + 50) {
        projectiles.current.splice(i, 1);
        continue;
      }

      // Collision detection
      if (p.isPlayer) {
        // Hit boss?
        const dx = p.x - boss.current.x;
        const dy = p.y - boss.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < boss.current.width / 2 + p.radius) {
          let damage = 150;
          if (modifiers.nutritionBalanceMode && Math.abs(balanceLevel.current) < 20) {
            damage *= 2; // Perfect balance doubles damage!
          }
          if (boss.current.state === 'ENTRANCE_CHICKEN') {
             // Invincible while descending
          } else {
             boss.current.health -= damage; // More damage since ammo is limited
          }
          boss.current.isHit = 0.1; // Flash timer
          
          if (modifiers.nutritionBalanceMode) {
            if (p.isHealthy) balanceLevel.current = Math.min(100, balanceLevel.current + 12);
            else balanceLevel.current = Math.max(-100, balanceLevel.current - 12);
          }
          
          // I-Ready Test increases by 50% (+500 points = +5.0% toward 1000% max) as boss takes damage
          const gain = 500;
          const maxCorruption = modifiers.accurateMode ? 75000 : 100000;
          boss.current.corruption = Math.min(maxCorruption, boss.current.corruption + gain);
          boss.current.regenRate = 15 + (boss.current.corruption / 500); // Regen scales with I-Ready Test score
          
          spawnParticles(p.x, p.y, '#4ade80', 15);
          spawnShockwave(p.x, p.y, p.isHealthy ? '#4ade80' : '#38bdf8', 110, 520, 4);
          comboCount.current += 1;
          comboTimer.current = 3.5;
          bossHitFlash.current = 0.14;
          const isCritHit = damage >= 300 || comboCount.current >= 5;
          battleSfxRef.current?.playBossHit(isCritHit);
          spawnFloatingText(
            boss.current.x,
            boss.current.y - boss.current.height * 0.4,
            damage >= 300 ? `CRIT -${damage}!` : `-${damage}`,
            damage >= 300 ? '#fde047' : '#4ade80',
            damage >= 300 ? 26 : 21
          );
          projectiles.current.splice(i, 1);
          
          if (boss.current.health <= 0) {
            if (boss.current.phase === 1) {
              startPhase2Cinematic();
            } else if (boss.current.phase === 2) {
              startPhase3Cinematic();
            } else {
              startDeathCutscene();
            }
          }
          continue;
        }
      } else {
        // Hit player?
        const dx = p.x - player.current.x;
        const dy = p.y - player.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < player.current.width / 2 + p.radius - 10) { // Slightly forgiving hitbox for player
          if (p.isHealthy) {
            // Grab & Deflect healthy salad back at boss + Heal Player!
            player.current.health = Math.min(player.current.maxHealth, player.current.health + 20);
            if (modifiers.accurateMode) {
              deflectedSalads.current++;
              if (deflectedSalads.current === 10 && !hasTriggeredSaladDialogue.current) {
                hasTriggeredSaladDialogue.current = true;
                setDialogueMode('SALAD_DISGUSTING');
                setDialogueIndex(0);
                setGameState('DIALOGUE');
              }
            } else {
              deflectedSalads.current++;
            }
            p.isPlayer = true;
            const angle = Math.atan2(boss.current.y - p.y, boss.current.x - p.x);
            const speed = 950;
            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed;
            p.trail = [{ x: p.x, y: p.y }];
            comboCount.current += 1;
            comboTimer.current = 3.5;
            parryFlash.current = 0.24;
            spawnParticles(p.x, p.y, '#22c55e', 18);
            spawnShockwave(p.x, p.y, '#22c55e', 180, 700, 4);
            spawnSlashArc(player.current.x, player.current.y, angle, 64, '#4ade80');
            const comboSuffix = comboCount.current >= 2 ? ` (${comboCount.current}x)` : '';
            spawnFloatingText(player.current.x, player.current.y - 26, `PARRY! +20 HP${comboSuffix}`, '#4ade80', 18);
            battleSfxRef.current?.playParry(comboCount.current);

            if (modifiers.nutritionBalanceMode) {
              balanceLevel.current = Math.min(100, balanceLevel.current + 10);
            }
          } else if (p.isBandAid) {
            // Heal from band-aid!
            player.current.health = Math.min(player.current.maxHealth, player.current.health + 25);
            spawnParticles(p.x, p.y, '#ffffff', 15);
            spawnShockwave(p.x, p.y, '#38bdf8', 140, 600, 3);
            spawnFloatingText(player.current.x, player.current.y - 26, '+25 HP', '#38bdf8', 18);
            battleSfxRef.current?.playHeal();
            projectiles.current.splice(i, 1);
          } else if (p.isSodaBlast) {
            isOnMoon.current = true;
            screenShake.current = 60;
            spawnShockwave(boss.current.x, boss.current.y, '#38bdf8', 800, 1400, 10);
            battleSfxRef.current?.playPulse();
            // Reset positions for moon fight
            player.current.x = WORLD_WIDTH / 2;
            player.current.y = WORLD_HEIGHT / 2;
            boss.current.x = WORLD_WIDTH / 2;
            boss.current.y = WORLD_HEIGHT / 2 - 300;
            boss.current.state = 'NORMAL';
            boss.current.slamTimer = 5;
            projectiles.current = [];
            cinematicTimer.current = 0; // Reset for transition text
            spawnParticles(p.x, p.y, '#ffffff', 50);
            break; // Stop processing projectiles after clearing the array
          } else {
            // Take damage from junk food (Invulnerable during helicopter cutscene or phase dash)
            const isCutsceneActive = helicopter.current.active && helicopter.current.phase && helicopter.current.phase !== 'COMBAT';
            if (dashInvuln.current > 0) {
              spawnFloatingText(player.current.x, player.current.y - 24, 'DODGE!', '#38bdf8', 17);
              spawnParticles(p.x, p.y, '#38bdf8', 8);
              projectiles.current.splice(i, 1);
            } else {
              if (!godMode.current && !modifiers.godMode && !isCutsceneActive) {
                const damage = p.isWhitePellet ? 20 : (p.isOreo ? 35 : (p.isChef ? 20 : (p.isOatmeal ? 25 : (p.isMonkBullet ? 18 : 15))));
                let finalDamage = damage;
                if (modifiers.hardMode) finalDamage *= 2.0;

                player.current.health -= finalDamage;
                player.current.isHit = 0.25;
                screenShake.current = Math.max(screenShake.current, 15);
                spawnShockwave(player.current.x, player.current.y, '#ef4444', 160, 600, 4);
                spawnGroundMark(p.x, p.y, 44, 'SCORCH', '#ef4444', 5);
                spawnFloatingText(player.current.x, player.current.y - 24, `-${Math.round(finalDamage)}`, '#f87171', 19);
                spawnParticles(p.x, p.y, p.isOreo ? '#334155' : (p.isChef ? '#ef4444' : (p.isOatmeal ? '#78350f' : (p.isMonkBullet ? '#fbbf24' : '#f87171'))), 12);
                triggerImpactFrame(player.current.x, player.current.y, '#ef4444', 0.048, 0.025);
                battleSfxRef.current?.playPlayerHit();
                
                if (modifiers.nutritionBalanceMode) {
                  if (p.isHealthy) balanceLevel.current = Math.min(100, balanceLevel.current + 10);
                  else balanceLevel.current = Math.max(-100, balanceLevel.current - 10);
                }

                if (modifiers.hardMode && Math.random() < 0.25) {
                  player.current.stunTimer = 1.0;
                  spawnParticles(player.current.x, player.current.y, '#fef08a', 20);
                }

                if (player.current.health <= 0) {
                  stopGame('GAME_OVER');
                }
              }
              projectiles.current.splice(i, 1);
            }
          }
          continue;
        }
      }
    }

    // Update particles
    for (let i = particles.current.length - 1; i >= 0; i--) {
      const p = particles.current[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        particles.current.splice(i, 1);
      }
    }

    // Update shockwaves
    for (let i = shockwaves.current.length - 1; i >= 0; i--) {
      const sw = shockwaves.current[i];
      sw.radius += sw.speed * dt;
      if (sw.radius >= sw.maxRadius) {
        shockwaves.current.splice(i, 1);
      }
    }

    // Update ground marks
    for (let i = groundMarks.current.length - 1; i >= 0; i--) {
      const gm = groundMarks.current[i];
      gm.life -= dt;
      if (gm.life <= 0) {
        groundMarks.current.splice(i, 1);
      }
    }

    // Update slash arcs
    for (let i = slashArcs.current.length - 1; i >= 0; i--) {
      const sa = slashArcs.current[i];
      sa.life -= dt;
      if (sa.life <= 0) {
        slashArcs.current.splice(i, 1);
      }
    }

    // Update floating combat texts
    for (let i = floatingTexts.current.length - 1; i >= 0; i--) {
      const ft = floatingTexts.current[i];
      ft.y += ft.vy * dt;
      ft.vy *= 0.94;
      ft.life -= dt;
      if (ft.life <= 0) {
        floatingTexts.current.splice(i, 1);
      }
    }

    // Hit flash timers
    if (player.current.isHit > 0) player.current.isHit -= dt;
    if (boss.current.isHit > 0) boss.current.isHit -= dt;

    // Boss state transition warning SFX
    if (boss.current.state !== prevBossState.current) {
      if (['SLAMMING', 'OREO_SANDWICH', 'SODA_BLAST', 'CHERRY_CHARGE', 'EARTHQUAKE_CRACK', 'ULTIMATE_SPAM', 'SUMMON_GUY'].includes(boss.current.state)) {
        battleSfxRef.current?.playWarning();
      }
      prevBossState.current = boss.current.state;
    }

    // Smooth delayed health trail bars for Battle UI
    if (bossTrailHealth.current > boss.current.health) {
      bossTrailHealth.current = Math.max(boss.current.health, bossTrailHealth.current - Math.max(120, (bossTrailHealth.current - boss.current.health) * 3.5) * dt);
    } else {
      bossTrailHealth.current = boss.current.health;
    }
    if (playerTrailHealth.current > player.current.health) {
      playerTrailHealth.current = Math.max(player.current.health, playerTrailHealth.current - Math.max(18, (playerTrailHealth.current - player.current.health) * 4.5) * dt);
    } else {
      playerTrailHealth.current = player.current.health;
    }

    if (infiniteHealth.current) {
      player.current.health = player.current.maxHealth;
    }

    syncBattleHud(false);
  };

  const drawBossVisuals = (ctx: CanvasRenderingContext2D) => {
    const b = boss.current;
    const now = performance.now();
    const w = b.width;
    const h = b.height;

    // 1. Boss Ground Shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, h * 0.45, w * 0.45, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Pre-Boss Aura & Environmental VFX (Behind the boss sprite)
    ctx.save();

    // State: SLAMMING (Meteor Plunge Re-entry)
    if (b.state === 'SLAMMING') {
      ctx.save();
      const slamGrad = ctx.createLinearGradient(0, -h * 1.5, 0, h * 0.5);
      slamGrad.addColorStop(0, 'rgba(239, 68, 68, 0)');
      slamGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.45)');
      slamGrad.addColorStop(1, 'rgba(239, 68, 68, 0.85)');
      ctx.fillStyle = slamGrad;
      ctx.beginPath();
      ctx.moveTo(-w * 0.4, h * 0.2);
      ctx.lineTo(w * 0.4, h * 0.2);
      ctx.lineTo(w * 0.7, -h * 1.6);
      ctx.lineTo(-w * 0.7, -h * 1.6);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 3;
      for (let i = -2; i <= 2; i++) {
        const offX = i * 28;
        const lineLen = 80 + Math.sin(now / 30 + i) * 30;
        ctx.beginPath();
        ctx.moveTo(offX, -h * 0.2);
        ctx.lineTo(offX, -h * 0.2 - lineLen);
        ctx.stroke();
      }
      ctx.restore();
    }

    // State: SUMMON_GUY (Mystic Summoning Circle)
    if (b.state === 'SUMMON_GUY') {
      ctx.save();
      ctx.rotate(now / 500);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#0ea5e9';
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.arc(0, 0, w * 0.7, 0, Math.PI * 2);
      ctx.stroke();

      for (let s = 0; s < 4; s++) {
        const sAng = (s * Math.PI) / 2 + now / 300;
        ctx.fillStyle = '#7dd3fc';
        ctx.beginPath();
        ctx.arc(Math.cos(sAng) * (w * 0.7), Math.sin(sAng) * (w * 0.7), 10, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    // State: RISING (Celestial Anti-Gravity Ascension)
    if (b.state === 'RISING') {
      ctx.save();
      for (let r = 0; r < 3; r++) {
        const ringProgress = ((now / 400 + r * 0.33) % 1.0);
        const ringY = h * 0.5 - ringProgress * (h * 0.8);
        const ringRadius = (w * 0.55) * (1 - ringProgress * 0.3);
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.8 * (1 - ringProgress)})`;
        ctx.lineWidth = 3.5;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.ellipse(0, ringY, ringRadius, ringRadius * 0.3, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // State: SUMMONING_DONGFISH (Mystic Ocean Summoning Tidal Vortex)
    if (b.state === 'SUMMONING_DONGFISH') {
      ctx.save();
      ctx.rotate(now / 800);
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.75)';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(0, 0, w * 0.65, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      for (let pt = 0; pt < 6; pt++) {
        const a = (pt * Math.PI) / 3;
        const rad = pt % 2 === 0 ? w * 0.65 : w * 0.35;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (pt === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();

      for (let f = 0; f < 3; f++) {
        const fishAngle = (now / 450) + (f * Math.PI * 2) / 3;
        const fx = Math.cos(fishAngle) * (w * 0.72);
        const fy = Math.sin(fishAngle) * (h * 0.72);
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(fishAngle + Math.PI / 2);
        ctx.fillStyle = '#67e8f9';
        ctx.beginPath();
        ctx.ellipse(0, 0, 16, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    // State: OREO_SANDWICH (Electromagnetic Gravity Clamp)
    if (b.state === 'OREO_SANDWICH') {
      ctx.save();
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 20;
      const numBolts = 6;
      for (let bIdx = 0; bIdx < numBolts; bIdx++) {
        const side = bIdx % 2 === 0 ? -1 : 1;
        const startX = side * (w * 1.3);
        const startY = (Math.random() - 0.5) * h;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        let currX = startX;
        let currY = startY;
        for (let seg = 0; seg < 4; seg++) {
          currX += (0 - currX) * 0.3 + (Math.random() - 0.5) * 30;
          currY += (Math.random() - 0.5) * 40;
          ctx.lineTo(currX, currY);
        }
        ctx.lineTo(0, 0);
        ctx.stroke();
      }

      const clampPulse = (Math.sin(now / 100) + 1) * 0.5;
      const arrDist = w * 0.9 - clampPulse * 25;
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.moveTo(-arrDist, -20);
      ctx.lineTo(-arrDist + 20, 0);
      ctx.lineTo(-arrDist, 20);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(arrDist, -20);
      ctx.lineTo(arrDist - 20, 0);
      ctx.lineTo(arrDist, 20);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // State: CHEF_SPIN (Gourmet Sauce Vortex)
    if (b.state === 'CHEF_SPIN') {
      ctx.save();
      const numRibbons = 4;
      for (let i = 0; i < numRibbons; i++) {
        const ribbonAngle = (now / 80) + (i * Math.PI) / 2;
        const rx = Math.cos(ribbonAngle) * (w * 0.75);
        const ry = Math.sin(ribbonAngle) * (h * 0.75);
        ctx.fillStyle = i % 2 === 0 ? '#ef4444' : '#f59e0b';
        ctx.shadowColor = '#dc2626';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(rx, ry, 14, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // State: OATMEAL_WALL (Hexagonal Aegis Fortress Shield)
    if (b.state === 'OATMEAL_WALL') {
      ctx.save();
      ctx.rotate(now / 1500);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 25;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const x = Math.cos(a) * (w * 0.7);
        const y = Math.sin(a) * (h * 0.7);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();

      ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * (w * 0.7), Math.sin(a) * (h * 0.7));
        ctx.stroke();
      }
      ctx.restore();
    }

    // State: CHERRY_CHARGE (Fizzy Rocket Boost Afterburners)
    if (b.state === 'CHERRY_CHARGE') {
      ctx.save();
      const numFlames = 3;
      for (let f = 0; f < numFlames; f++) {
        const fProg = ((now / 80 + f * 0.33) % 1.0);
        const fLen = 80 + (1 - fProg) * 70;
        const fWidth = 24 * (1 - fProg);
        ctx.fillStyle = f % 2 === 0 ? '#f43f5e' : '#fb7185';
        ctx.shadowColor = '#e11d48';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.ellipse(-w * 0.25 + f * 25, h * 0.4 + fLen / 2, fWidth, fLen / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // State: ULTIMATE_SPAM (Chromatic Gyro Astrolabe Overdrive)
    if (b.state === 'ULTIMATE_SPAM') {
      ctx.save();
      const colors = ['#f43f5e', '#a855f7', '#06b6d4', '#eab308'];
      for (let r = 0; r < 3; r++) {
        ctx.save();
        ctx.rotate((now / (150 + r * 50)) * (r % 2 === 0 ? 1 : -1));
        ctx.strokeStyle = colors[r % colors.length];
        ctx.lineWidth = 3.5;
        ctx.shadowColor = colors[r % colors.length];
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.ellipse(0, 0, w * (0.65 + r * 0.15), h * (0.35 + r * 0.1), (r * Math.PI) / 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    // State: EARTHQUAKE_CRACK & SMASH_2 (Subterranean Magma Fissures)
    if (b.state === 'EARTHQUAKE_CRACK' || b.state === 'SMASH_2') {
      ctx.save();
      for (let i = 0; i < 2; i++) {
        const prog = ((now / 500 + i * 0.5) % 1.0);
        const rad = (w * 0.4) + prog * (w * 0.8);
        ctx.strokeStyle = `rgba(234, 88, 12, ${0.9 * (1 - prog)})`;
        ctx.lineWidth = 4 * (1 - prog);
        ctx.shadowColor = '#ea580c';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(0, 0, rad, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // State: WHEELCHAIR (Turbo Burnout Smoke & Drift Sparks)
    if (b.state === 'WHEELCHAIR') {
      ctx.save();
      for (let s = 0; s < 4; s++) {
        const sProg = ((now / 200 + s * 0.25) % 1.0);
        const sx = -w * 0.35 - sProg * 60;
        const sy = h * 0.35 + (s % 2 === 0 ? 10 : -10);
        ctx.fillStyle = `rgba(100, 116, 139, ${0.5 * (1 - sProg)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 16 + sProg * 20, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#fef08a';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 10;
      for (let sp = 0; sp < 3; sp++) {
        const spX = -w * 0.3 + (Math.random() - 0.5) * 20;
        const spY = h * 0.4 + Math.random() * 10;
        ctx.fillRect(spX, spY, 4, 4);
      }
      ctx.restore();
    }

    // General Fiery / Dark Aura for high corruption or RAGE or SODA_BLAST
    if (b.corruption > 300 || b.state === 'RAGE' || b.state === 'SODA_BLAST') {
      ctx.save();
      ctx.shadowColor = b.state === 'SODA_BLAST' ? '#f43f5e' : '#dc2626';
      ctx.shadowBlur = 35 + Math.sin(now / 100) * 15;
      ctx.strokeStyle = b.state === 'SODA_BLAST' ? 'rgba(244, 63, 94, 0.7)' : 'rgba(239, 68, 68, 0.65)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, w * 0.6 + Math.sin(now / 150) * 12, 0, Math.PI * 2);
      ctx.stroke();

      if (b.state === 'RAGE') {
        const spikes = 12;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
        for (let sp = 0; sp < spikes; sp++) {
          const sAngle = (sp * Math.PI * 2) / spikes + now / 300;
          const sDist = w * 0.62 + Math.sin(now / 80 + sp) * 18;
          ctx.beginPath();
          ctx.arc(Math.cos(sAngle) * sDist, Math.sin(sAngle) * sDist, 10, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // 3. Transformations & Sprites
    const pulse = 1 + Math.sin(now / 180) * 0.04;
    const breathX = 1 + Math.sin(now / 240) * 0.035;
    const breathY = 1 - Math.sin(now / 240) * 0.035;
    ctx.scale(pulse * breathX, pulse * breathY);

    if (b.state === 'SLAMMING') {
      ctx.scale(0.72, 1.45);
    } else if (b.state === 'RISING') {
      ctx.scale(1.15, 0.88);
    } else if (b.state === 'SMASH_2') {
      ctx.scale(1.35, 1.35);
    } else if (b.state === 'RAGE') {
      ctx.scale(1.22, 1.22);
    } else if (b.state === 'WHEELCHAIR') {
      const driftTilt = Math.sin(now / 50) * 0.08;
      ctx.rotate(driftTilt);
    } else if (b.state === 'CHEF_SPIN') {
      ctx.rotate(now / 50);
    } else if (b.state === 'ULTIMATE_SPAM') {
      ctx.rotate(now / 20);
      ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
    } else if (b.state === 'DIZZY') {
      ctx.rotate(b.direction + Math.sin(now / 100) * 0.25);
    }

    if (modifiers.monkCartmanMode) {
      const tilt = Math.sin(now / 400) * 0.1;
      ctx.rotate(tilt);
    }

    if (b.isHit > 0) {
      ctx.filter = 'brightness(2) sepia(1) hue-rotate(-50deg) saturate(5)';
    }

    if (b.state === 'RAGE' || b.state === 'SODA_BLAST') {
      ctx.filter = 'contrast(2) brightness(1.2) hue-rotate(-30deg)';
    }

    let img = modifiers.breakingPoint ? breakingPointImage : activeBossImage.current;
    if (b.state === 'WHEELCHAIR' && !modifiers.breakingPoint) {
      img = wheelchairImage;
    }

    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    } else {
      ctx.font = `${w * 0.8}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.drawImage(bossImage, -w/2, -h/2, w, h);
    }

    // Floating Sneeze Text Overlay ("ACHOO! 🤧")
    if (sneezeTimer.current > 0) {
      ctx.save();
      ctx.font = '900 46px Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#3f6212';
      ctx.strokeText('ACHOO! 🤧', 0, -h * 0.55);
      ctx.fillStyle = '#84cc16';
      ctx.fillText('ACHOO! 🤧', 0, -h * 0.55);
      ctx.restore();
    }

    // 4. Foreground Attack Effects & Overlays

    // State: SODA_BLAST (Beam Laser + Crackling Plasma Arcs)
    if (b.state === 'SODA_BLAST') {
      ctx.save();
      ctx.rotate(b.direction);
      const beamGrad = ctx.createLinearGradient(0, 0, 1800, 0);
      beamGrad.addColorStop(0, 'rgba(244, 63, 94, 0.95)');
      beamGrad.addColorStop(0.5, 'rgba(251, 113, 133, 0.7)');
      beamGrad.addColorStop(1, 'rgba(244, 63, 94, 0)');
      ctx.fillStyle = beamGrad;
      ctx.fillRect(w * 0.3, -45, 1800, 90);

      const coreGrad = ctx.createLinearGradient(0, 0, 1800, 0);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.3, '#fecdd3');
      coreGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = coreGrad;
      ctx.fillRect(w * 0.3, -15, 1800, 30);

      // Crackling electric plasma arcs surging down the beam
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      for (let seg = 0; seg <= 14; seg++) {
        const bx = w * 0.35 + seg * 115;
        const by = seg === 0 ? 0 : Math.sin(now / 28 + seg * 1.9) * 34;
        if (seg === 0) ctx.moveTo(bx, by);
        else ctx.lineTo(bx, by);
      }
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.arc(w * 0.35, 0, 35 + Math.sin(now / 50) * 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // State: DIZZY Stars and Birds
    if (b.state === 'DIZZY') {
      ctx.save();
      for (let i = 0; i < 5; i++) {
        const starAngle = (i / 5) * Math.PI * 2 + now / 200;
        const sx = Math.cos(starAngle) * (w * 0.55);
        const sy = Math.sin(starAngle) * 45 - h * 0.4;
        ctx.font = '26px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(i % 2 === 0 ? '💫' : '⭐', sx, sy);
      }
      ctx.restore();
    }

    // State: ENTRANCE_CHICKEN Held Prop
    if (b.state === 'ENTRANCE_CHICKEN') {
      ctx.save();
      const chickW = w * 0.95;
      const chickH = h * 0.95;
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 30;
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(0, -h * 0.55, 50, 14, 0, 0, Math.PI * 2);
      ctx.stroke();

      if (junkFoodImage.complete && junkFoodImage.naturalWidth > 0) {
        ctx.drawImage(junkFoodImage, -chickW / 2, h / 4, chickW, chickH);
      } else {
        ctx.font = `${chickW}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🍗', 0, h / 2);
      }
      ctx.restore();
    }

    // Stage 3: Cosmic Violet-Crimson Halo + Mounted 6-Barrel Calorie Minigun!
    if (b.phase >= 3) {
      ctx.save();
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.85)';
      ctx.lineWidth = 5;
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.arc(0, 0, w * 0.64 + Math.sin(now / 110) * 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Mounted Rotary 6-Barrel Calorie Minigun
      const isFiringMinigun = b.state === 'MINIGUN_BARRAGE';
      const gunAng = isFiringMinigun ? minigunAimAngle.current : Math.atan2(player.current.y - b.y, player.current.x - b.x);
      const recoil = isFiringMinigun ? Math.sin(now * 0.14) * 5 : 0;
      const barrelSpin = isFiringMinigun ? now * 0.035 : now * 0.004;

      ctx.save();
      ctx.rotate(gunAng);
      ctx.translate(w * 0.34 - recoil, h * 0.14);

      // Minigun receiver housing
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = isFiringMinigun ? '#fbbf24' : '#a855f7';
      ctx.lineWidth = 2.5;
      ctx.fillRect(-18, -17, 36, 34);
      ctx.strokeRect(-18, -17, 36, 34);

      // Glowing Calorie Ammo Drum
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(-4, 18, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fbbf24';
      ctx.stroke();

      // 6 Rotating Gatling Barrels
      for (let br = 0; br < 4; br++) {
        const bOff = Math.sin(barrelSpin + (br * Math.PI) / 2) * 8;
        ctx.fillStyle = isFiringMinigun && br % 2 === 0 ? '#f97316' : '#64748b';
        ctx.fillRect(18, bOff - 2.5, 44, 5);
      }
      // Barrel clamp rings
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(34, -12, 6, 24);
      ctx.fillRect(54, -12, 6, 24);

      // Muzzle blast flash when firing 55 RPS!
      if (isFiringMinigun) {
        const flareR = 20 + Math.random() * 16;
        const flareGrad = ctx.createRadialGradient(66, 0, 2, 66, 0, flareR);
        flareGrad.addColorStop(0, '#ffffff');
        flareGrad.addColorStop(0.35, '#fde047');
        flareGrad.addColorStop(0.75, 'rgba(239, 68, 68, 0.85)');
        flareGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = flareGrad;
        ctx.beginPath();
        ctx.arc(66, 0, flareR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.restore();
  };

  const drawDeathCutscene = (ctx: CanvasRenderingContext2D, W: number, H: number) => {
    const dc = deathCutscene.current;
    const t = dc.timer;
    const bossTitle = modifiers.monkCartmanMode ? 'MONK CARTMAN' : 'GORGOTOLISIS';
    const bossImg = modifiers.breakingPoint
      ? breakingPointImage
      : modifiers.monkCartmanMode
      ? helicopterImage
      : activeBossImage.current;

    ctx.save();
    ctx.fillStyle = '#020107';
    ctx.fillRect(0, 0, W, H);

    // Camera Shake Calculation per Act
    let shakeAmt = 0;
    if (t < 1.2) shakeAmt = 26 * (1 - t / 1.2);
    else if (t < 10.0) {
      const beat = (t * 0.9) % 1.0;
      shakeAmt = beat < 0.18 ? 14 * (1 - beat / 0.18) : 2.5;
    } else if (t >= 10.0 && t < 22.0) {
      shakeAmt = t > 18.0 && t < 20.0 ? 22 * (1 - (t - 18.0) / 2.0) : 4;
    } else if (t >= 28.0 && t < 34.0) {
      shakeAmt = ((t - 28.0) / 6.0) * 16;
    } else if (t >= 34.8 && t < 38.5) {
      shakeAmt = 40 * Math.max(0, 1 - (t - 34.8) / 3.7);
    }
    const shakeX = (Math.random() - 0.5) * shakeAmt;
    const shakeY = (Math.random() - 0.5) * shakeAmt;

    // -------------------------------------------------
    // BACKGROUND SKY / ENVIRONMENT PER ACT
    // -------------------------------------------------
    if (t < 22.0) {
      // ACT I & II: Abyssal Cosmic Void -> Crumbling Crimson/Violet Junk Realm
      const act2Blend = Math.max(0, Math.min(1, (t - 9.0) / 3.0));
      const bgGrad = ctx.createRadialGradient(W * 0.5, H * 0.44, 20, W * 0.5, H * 0.44, Math.max(W, H) * 0.85);
      bgGrad.addColorStop(0, act2Blend > 0.5 ? '#4c0519' : '#2e0516');
      bgGrad.addColorStop(0.5, act2Blend > 0.5 ? '#1e0b36' : '#12031e');
      bgGrad.addColorStop(1, '#020107');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Stars & Dimensional Sky Cracks in Act II
      dc.stars.forEach((st, idx) => {
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * st.speed * 2 + st.twinkle));
        ctx.fillStyle = st.color;
        ctx.globalAlpha = tw * (0.35 + act2Blend * 0.65);
        ctx.beginPath();
        ctx.arc(st.x * W + shakeX * 0.2, st.y * H + shakeY * 0.2, st.size, 0, Math.PI * 2);
        ctx.fill();
        if (idx % 12 === 0 && act2Blend > 0.2) {
          ctx.globalAlpha = 0.08 * act2Blend;
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(st.x * W, st.y * H, st.size * 10, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1;

      // Sky Fracture Lightning Lines (Act II: 10s - 22s)
      if (t >= 10.0) {
        const crackAlpha = Math.min(1, (t - 10.0) / 2.0) * 0.65;
        ctx.save();
        ctx.strokeStyle = `rgba(251, 191, 36, ${crackAlpha})`;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 18;
        for (let k = 0; k < 5; k++) {
          const sx = (0.12 + k * 0.19) * W;
          ctx.beginPath();
          ctx.moveTo(sx, 0);
          ctx.lineTo(sx + Math.sin(k * 7) * 35, H * 0.18);
          ctx.lineTo(sx - Math.cos(k * 5) * 45, H * 0.34);
          ctx.lineTo(sx + Math.sin(k * 11) * 25, H * 0.48);
          ctx.stroke();
        }
        ctx.restore();
      }
    } else if (t < 34.8) {
      // ACT III: Nutritional Singularity Abyss (Emerald-Gold Vortex Horizon)
      const prog = (t - 22.0) / 12.8;
      const bgGrad = ctx.createRadialGradient(W * 0.5, H * 0.42, 10, W * 0.5, H * 0.42, Math.max(W, H) * 0.85);
      bgGrad.addColorStop(0, t > 34.0 ? '#000000' : '#064e3b');
      bgGrad.addColorStop(0.45, t > 34.0 ? '#000000' : '#1e1b4b');
      bgGrad.addColorStop(1, '#020107');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Stars bending toward singularity center during 28s - 34s
      const pull = Math.max(0, (t - 28.0) / 6.0);
      dc.stars.forEach(st => {
        const sx = st.x * W + (W * 0.5 - st.x * W) * pull * 0.65;
        const sy = st.y * H + (H * 0.42 - st.y * H) * pull * 0.65;
        ctx.fillStyle = pull > 0.2 ? '#a7f3d0' : st.color;
        ctx.globalAlpha = t > 34.0 ? Math.max(0, 1 - (t - 34.0) * 3) : 0.85;
        ctx.beginPath();
        ctx.arc(sx, sy, st.size * (1 + prog * 0.5), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    } else if (t < 44.0) {
      // ACT IV: Supernova of Purity -> Nebula Clearing
      const post = Math.max(0, (t - 34.8) / 9.2);
      const bgGrad = ctx.createRadialGradient(W * 0.5, H * 0.45, 20, W * 0.5, H * 0.45, Math.max(W, H) * 0.9);
      bgGrad.addColorStop(0, post < 0.35 ? '#fef08a' : '#0f766e');
      bgGrad.addColorStop(0.5, '#1e1b4b');
      bgGrad.addColorStop(1, '#020617');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      dc.stars.forEach(st => {
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * st.speed + st.twinkle));
        ctx.fillStyle = st.color;
        ctx.globalAlpha = tw * Math.min(1, post * 2.2);
        ctx.beginPath();
        ctx.arc(st.x * W, st.y * H, st.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    } else {
      // ACT V & VI (44s - 60s): Dawn Over the Reclaimed Realm (Sunrise + Aurora)
      const dawnProg = Math.min(1, (t - 44.0) / 6.0);
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
      skyGrad.addColorStop(0, '#020617');
      skyGrad.addColorStop(0.45, '#0f172a');
      skyGrad.addColorStop(0.75, dawnProg > 0.3 ? '#065f46' : '#1e1b4b');
      skyGrad.addColorStop(1, '#d97706');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, H);

      // Twinkling crisp stars in upper sky
      dc.stars.forEach(st => {
        if (st.y > 0.72) return;
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * st.speed + st.twinkle));
        ctx.fillStyle = st.color;
        ctx.globalAlpha = tw * (1 - st.y) * 1.1;
        ctx.beginPath();
        ctx.arc(st.x * W, st.y * H, st.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Flowing Emerald & Cyan Aurora Borealis Ribbons
      ctx.save();
      for (let a = 0; a < 3; a++) {
        const aurGrad = ctx.createLinearGradient(0, H * 0.14, 0, H * 0.48);
        aurGrad.addColorStop(0, 'rgba(52, 211, 153, 0)');
        aurGrad.addColorStop(0.5, a === 1 ? 'rgba(56, 189, 248, 0.24)' : 'rgba(74, 222, 128, 0.26)');
        aurGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
        ctx.fillStyle = aurGrad;
        ctx.beginPath();
        ctx.moveTo(0, H * (0.28 + a * 0.05));
        for (let x = 0; x <= W; x += 40) {
          const wave = Math.sin(x * 0.005 + t * (0.7 + a * 0.25) + a * 2) * 35;
          ctx.lineTo(x, H * (0.24 + a * 0.05) + wave);
        }
        ctx.lineTo(W, H * 0.52);
        ctx.lineTo(0, H * 0.52);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Rising Golden Sun on Horizon
      const sunY = H * (0.82 - dawnProg * 0.14);
      const sunGrad = ctx.createRadialGradient(W * 0.5, sunY, 15, W * 0.5, sunY, W * 0.45);
      sunGrad.addColorStop(0, 'rgba(254, 249, 195, 0.95)');
      sunGrad.addColorStop(0.18, 'rgba(251, 191, 36, 0.55)');
      sunGrad.addColorStop(0.55, 'rgba(245, 158, 11, 0.14)');
      sunGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = sunGrad;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.fillStyle = '#fef9c3';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 45;
      ctx.beginPath();
      ctx.arc(W * 0.5, sunY, 54, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // -------------------------------------------------
    // MONOLITHS / CRUMBLING REALM ARCHITECTURE (10s - 34s)
    // -------------------------------------------------
    if (t >= 10.0 && t < 34.8) {
      const mAlpha = t < 11.5 ? (t - 10.0) / 1.5 : t > 32.0 ? Math.max(0, 1 - (t - 32.0) / 2.8) : 1;
      dc.monoliths.forEach(m => {
        ctx.save();
        ctx.globalAlpha = mAlpha * 0.85;
        ctx.translate(m.x * W + shakeX * m.depth, m.y * H + shakeY * m.depth);
        ctx.rotate(m.tilt);
        ctx.fillStyle = m.color;
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
        ctx.lineWidth = 2;
        ctx.fillRect(-m.w / 2, -m.h / 2, m.w, m.h);
        ctx.strokeRect(-m.w / 2, -m.h / 2, m.w, m.h);
        // Glowing magma fissure down each pillar
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
        ctx.beginPath();
        ctx.moveTo(0, -m.h * 0.4);
        ctx.lineTo(-m.w * 0.15, 0);
        ctx.lineTo(m.w * 0.1, m.h * 0.35);
        ctx.stroke();
        ctx.restore();
      });
    }

    // -------------------------------------------------
    // MAIN SCENE ACTORS & SETPIECES
    // -------------------------------------------------
    ctx.save();
    ctx.translate(shakeX, shakeY);

    // ACT I (0 - 10s): Dramatic Zoom-In on Fracturing Boss + Escaping Junk Food Spirits
    if (t < 10.0) {
      const zoom = 1.0 + (t / 10.0) * 0.78;
      const bossCX = W * 0.5;
      const bossCY = H * 0.48;
      const bossSize = 190 * zoom;

      // Crimson-Gold Core Aura behind boss
      const auraR = bossSize * (0.95 + Math.sin(t * 9) * 0.08);
      const auraGrad = ctx.createRadialGradient(bossCX, bossCY, bossSize * 0.15, bossCX, bossCY, auraR);
      auraGrad.addColorStop(0, 'rgba(254, 240, 138, 0.85)');
      auraGrad.addColorStop(0.45, 'rgba(239, 68, 68, 0.55)');
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(bossCX, bossCY, auraR, 0, Math.PI * 2);
      ctx.fill();

      // Draw trembling Boss Sprite
      ctx.save();
      const shudderX = Math.sin(t * 58) * (4 + t * 0.8);
      const shudderY = Math.cos(t * 47) * (3 + t * 0.6);
      ctx.translate(bossCX + shudderX, bossCY + shudderY);
      ctx.rotate(Math.sin(t * 6) * 0.08);
      if (Math.floor(t * 14) % 5 === 0) {
        ctx.filter = 'brightness(1.8) contrast(1.4) hue-rotate(-20deg)';
      }
      if (bossImg.complete && bossImg.naturalWidth > 0) {
        ctx.drawImage(bossImg, -bossSize / 2, -bossSize / 2, bossSize, bossSize);
      }
      ctx.restore();

      // Glowing Jagged Cracks Spreading Across Boss
      ctx.save();
      ctx.translate(bossCX + shudderX, bossCY + shudderY);
      ctx.scale(zoom, zoom);
      dc.cracks.forEach(cr => {
        if (t < cr.delay) return;
        const grow = Math.min(1, (t - cr.delay) / 1.5);
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = cr.width;
        ctx.shadowColor = '#4ade80';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const count = Math.ceil(cr.segments.length * grow);
        for (let s = 0; s < count; s++) {
          ctx.lineTo(cr.segments[s].dx, cr.segments[s].dy);
        }
        ctx.stroke();
      });
      ctx.restore();

      // Escaping Junk Food Spirits erupting from cracks
      dc.bossShards.forEach(sh => {
        if (!sh.emoji || t < sh.delay) return;
        const dtS = t - sh.delay;
        const sx = bossCX + sh.x + sh.vx * dtS * 0.65;
        const sy = bossCY + sh.y + sh.vy * dtS * 0.65 - dtS * 45;
        const alpha = Math.max(0, 1 - dtS / 3.2);
        if (alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(sx, sy);
        ctx.rotate(sh.rot + sh.vRot * dtS);
        ctx.font = `${sh.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sh.emoji, 0, 0);
        ctx.restore();
      });

      // Manga Impact Freeze Flash & Radial Lines (0.0s - 1.4s)
      if (t < 1.4) {
        const flashAlpha = Math.max(0, 1 - t / 0.55);
        if (flashAlpha > 0) {
          ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
          ctx.fillRect(0, 0, W, H);
        }
        ctx.save();
        ctx.strokeStyle = `rgba(254, 240, 138, ${Math.max(0, 1 - t / 1.4) * 0.7})`;
        ctx.lineWidth = 3;
        for (let l = 0; l < 36; l++) {
          const ang = (l / 36) * Math.PI * 2;
          const innerR = 90 + t * 240;
          const outerR = Math.max(W, H);
          ctx.beginPath();
          ctx.moveTo(bossCX + Math.cos(ang) * innerR, bossCY + Math.sin(ang) * innerR);
          ctx.lineTo(bossCX + Math.cos(ang) * outerR, bossCY + Math.sin(ang) * outerR);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // ACT II (10s - 22s): Panoramic Realm Collapse & I-Ready Core Failure
    else if (t < 22.0) {
      const localT = t - 10.0;
      const camPull = Math.max(0.85, 1.35 - (localT / 12.0) * 0.5);
      const bossCX = W * 0.5;
      const bossCY = H * 0.44 + Math.sin(t * 1.5) * 12;
      const bossSize = 210 * camPull;

      // Cracked Obsidian Pedestal floating beneath Boss
      ctx.save();
      ctx.translate(bossCX, bossCY + bossSize * 0.75);
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-220 * camPull, 0);
      ctx.lineTo(220 * camPull, 0);
      ctx.lineTo(150 * camPull, 75 * camPull);
      ctx.lineTo(-165 * camPull, 68 * camPull);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Failing Holographic I-Ready Core Rings (10s - 18s)
      if (t < 18.2) {
        const ringAlpha = t > 17.5 ? Math.max(0, 1 - (t - 17.5) / 0.7) : 1;
        ctx.save();
        ctx.globalAlpha = ringAlpha;
        ctx.translate(bossCX, bossCY);
        ctx.rotate(t * 1.6);
        ctx.strokeStyle = Math.floor(t * 10) % 2 === 0 ? '#ef4444' : '#f59e0b';
        ctx.lineWidth = 5;
        ctx.setLineDash([28, 14]);
        ctx.beginPath();
        ctx.arc(0, 0, bossSize * 0.92, 0, Math.PI * 2);
        ctx.stroke();
        ctx.rotate(-t * 3.1);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, bossSize * 1.12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Holographic warning text over boss
        ctx.save();
        ctx.globalAlpha = ringAlpha * (0.6 + Math.sin(t * 22) * 0.4);
        ctx.font = '900 18px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fca5a5';
        ctx.fillText('⚠ I-READY CORE INTEGRITY: CRITICAL FAILURE ⚠', bossCX, bossCY - bossSize * 0.72);
        ctx.restore();
      }

      // Orbiting Dying Big Macs burning to ash
      for (let b = 0; b < 6; b++) {
        if (t > 13.0 + b * 1.1) continue;
        const ang = (b / 6) * Math.PI * 2 + t * 2.4;
        const rad = bossSize * 0.95;
        const bx = bossCX + Math.cos(ang) * rad;
        const by = bossCY + Math.sin(ang) * rad * 0.45;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(t * 5);
        ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - (12.0 + b * 1.1)));
        if (bigMacImage.complete && bigMacImage.naturalWidth > 0) {
          ctx.drawImage(bigMacImage, -26, -26, 52, 52);
        } else {
          ctx.font = '38px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🍔', 0, 0);
        }
        ctx.restore();
      }

      // Boss Sprite with violent glitch flicker
      ctx.save();
      ctx.translate(bossCX + Math.sin(t * 44) * 5, bossCY);
      if (Math.floor(t * 18) % 6 === 0) {
        ctx.filter = 'hue-rotate(140deg) saturate(3) brightness(1.6)';
      }
      if (bossImg.complete && bossImg.naturalWidth > 0) {
        ctx.drawImage(bossImg, -bossSize / 2, -bossSize / 2, bossSize, bossSize);
      }
      ctx.restore();
    }

    // ACT III (22s - 34.8s): Hero Convergence & Nutritional Singularity Implosion
    else if (t < 34.8) {
      const localT = t - 22.0;
      const bossCX = W * 0.5;
      const bossCY = H * 0.36;
      const heroCX = W * 0.5;
      const heroCY = H * 0.76;

      // Implosion compression after 28s, pitch-black star point after 34.0s
      const compress = t < 28.0 ? 1 : Math.max(0.06, 1 - (t - 28.0) / 6.0);
      const isSilenceBeat = t >= 34.0;

      if (!isSilenceBeat) {
        // Volumetric God-Rays piercing outward from Boss
        const rayCount = 16;
        const rayIntensity = Math.min(1, localT / 6.0);
        ctx.save();
        ctx.translate(bossCX, bossCY);
        ctx.rotate(t * 0.25);
        for (let r = 0; r < rayCount; r++) {
          const ang = (r / rayCount) * Math.PI * 2;
          ctx.save();
          ctx.rotate(ang);
          const rayGrad = ctx.createLinearGradient(0, 0, Math.max(W, H) * 0.85, 0);
          rayGrad.addColorStop(0, `rgba(167, 243, 208, ${0.42 * rayIntensity})`);
          rayGrad.addColorStop(0.5, `rgba(251, 191, 36, ${0.15 * rayIntensity})`);
          rayGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = rayGrad;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.max(W, H) * 0.85, -36);
          ctx.lineTo(Math.max(W, H) * 0.85, 36);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();

        // Boss shrinking/warping into singularity
        const bossSize = 185 * compress;
        ctx.save();
        ctx.translate(bossCX + Math.sin(t * 60) * (1 - compress) * 8, bossCY);
        ctx.rotate((1 - compress) * 2.5);
        ctx.filter = `brightness(${1 + (1 - compress) * 2.5}) saturate(${1 + (1 - compress) * 2})`;
        if (bossImg.complete && bossImg.naturalWidth > 0) {
          ctx.drawImage(bossImg, -bossSize / 2, -bossSize / 2, bossSize, bossSize);
        }
        ctx.restore();

        // Blinding Singularity Core over Boss chest
        const coreR = (20 + localT * 5) * (t > 28.0 ? 1.4 : 1);
        const coreGrad = ctx.createRadialGradient(bossCX, bossCY, 2, bossCX, bossCY, coreR * 2.4);
        coreGrad.addColorStop(0, '#ffffff');
        coreGrad.addColorStop(0.3, '#4ade80');
        coreGrad.addColorStop(0.7, 'rgba(251, 191, 36, 0.35)');
        coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(bossCX, bossCY, coreR * 2.4, 0, Math.PI * 2);
        ctx.fill();

        // Nutritional Convergence Spirals rising from Player -> Boss
        dc.ribbons.forEach((rb, idx) => {
          const cycle = (localT * rb.speed * 0.28 + idx / dc.ribbons.length) % 1.0;
          const rx = heroCX + (bossCX - heroCX) * cycle + Math.cos(cycle * 9 + rb.angleOffset) * (1 - cycle) * 140 * rb.radiusScale;
          const ry = heroCY + (bossCY - heroCY) * cycle;
          ctx.save();
          ctx.globalAlpha = Math.sin(cycle * Math.PI);
          ctx.font = `${18 + (1 - cycle) * 8}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = rb.color;
          ctx.shadowBlur = 12;
          ctx.fillText(rb.emoji, rx, ry);
          ctx.restore();
        });

        // Floating Sanctuary Platform & Player Hero Silhouetted Below
        const heroFade = t > 32.5 ? Math.max(0, 1 - (t - 32.5) / 1.5) : 1;
        ctx.save();
        ctx.globalAlpha = heroFade;
        // Glowing Emerald Platform
        const platGrad = ctx.createLinearGradient(heroCX - 110, heroCY + 24, heroCX + 110, heroCY + 58);
        platGrad.addColorStop(0, '#065f46');
        platGrad.addColorStop(1, '#022c22');
        ctx.fillStyle = platGrad;
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(heroCX, heroCY + 30, 110, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Player Skin
        const activeSkin = SHOP_SKINS.find(s => s.id === currentSkin.current) || SHOP_SKINS[0];
        ctx.shadowColor = '#4ade80';
        ctx.shadowBlur = 22;
        if (activeSkin.type === 'image') {
          const img = skinImages[activeSkin.id];
          if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, heroCX - 28, heroCY - 28, 56, 56);
          }
        } else {
          ctx.font = '50px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(activeSkin.value, heroCX, heroCY);
        }

        // Optional Monk Cartman Helicopter Salute in background sky (when not fighting Monk Cartman)
        if (!modifiers.monkCartmanMode && t >= 24.0 && t <= 31.5 && helicopterImage.complete) {
          const hProg = (t - 24.0) / 7.5;
          const hx = W * (0.14 + hProg * 0.14);
          const hy = H * 0.28 + Math.sin(t * 2) * 8;
          ctx.globalAlpha = Math.sin(hProg * Math.PI) * 0.75;
          ctx.drawImage(helicopterImage, hx - 70, hy - 35, 140, 70);
        }
        ctx.restore();
      } else {
        // 34.0s - 34.8s: The Silent Heartbeat — Pitch Black + Single Diamond Star
        ctx.fillStyle = '#000000';
        ctx.fillRect(-50, -50, W + 100, H + 100);
        const pulse = 1 + Math.sin((t - 34.0) * 35) * 0.35;
        ctx.save();
        ctx.translate(W * 0.5, H * 0.42);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#4ade80';
        ctx.shadowBlur = 35;
        ctx.beginPath();
        ctx.arc(0, 0, 7 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-45 * pulse, -1.5, 90 * pulse, 3);
        ctx.fillRect(-1.5, -45 * pulse, 3, 90 * pulse);
        ctx.restore();
      }
    }

    // ACT IV (34.8s - 44.0s): Supernova Detonation & Boss Stardust Dissolution
    else if (t < 44.0) {
      const post = t - 34.8;
      const bossCX = W * 0.5;
      const bossCY = H * 0.45;

      // Fading ghost silhouette of Boss dissolving into stardust (34.8s - 39.5s)
      if (post < 5.0) {
        const ghostAlpha = Math.max(0, 1 - post / 4.8);
        const ghostScale = 1 + post * 0.35;
        const size = 210 * ghostScale;
        ctx.save();
        ctx.globalAlpha = ghostAlpha * 0.65;
        ctx.translate(bossCX, bossCY - post * 18);
        ctx.filter = 'brightness(3) contrast(0.8)';
        if (bossImg.complete && bossImg.naturalWidth > 0) {
          ctx.drawImage(bossImg, -size / 2, -size / 2, size, size);
        }
        ctx.restore();
      }

      // 115 Luminous Stardust Shards Spiraling Upward
      dc.bossShards.forEach(sh => {
        const dtS = Math.max(0, post - sh.delay * 0.25);
        if (dtS <= 0) return;
        const sx = bossCX + sh.x + sh.vx * dtS * 0.9;
        const sy = bossCY + sh.y + sh.vy * dtS * 0.9 - dtS * dtS * 12;
        const alpha = Math.max(0, 1 - dtS / 7.5);
        if (alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(sx, sy);
        ctx.rotate(sh.rot + sh.vRot * dtS);
        ctx.fillStyle = sh.color;
        ctx.shadowColor = sh.color;
        ctx.shadowBlur = 14;
        if (sh.emoji) {
          ctx.font = `${sh.size * 0.8}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(sh.emoji, 0, 0);
        } else {
          ctx.beginPath();
          ctx.moveTo(0, -sh.size);
          ctx.lineTo(sh.size * 0.7, 0);
          ctx.lineTo(0, sh.size);
          ctx.lineTo(-sh.size * 0.7, 0);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      });

      // Blinding Supernova Flash Decay (34.8s - 37.5s)
      if (post < 2.8) {
        const flashA = Math.max(0, 1 - post / 2.8);
        ctx.fillStyle = `rgba(255, 255, 240, ${flashA * 0.95})`;
        ctx.fillRect(-50, -50, W + 100, H + 100);
      }
    }

    // ACT V & VI (44.0s - 60.0s): Dawn Over the Reclaimed Realm + Victory Title Card
    else {
      const localT = t - 44.0;
      const horizonY = H * 0.76;

      // Peaceful Rolling Horizon Hills Silhouette
      ctx.save();
      ctx.fillStyle = '#022c22';
      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.lineTo(0, horizonY);
      ctx.quadraticCurveTo(W * 0.25, horizonY - 45, W * 0.5, horizonY - 12);
      ctx.quadraticCurveTo(W * 0.78, horizonY + 20, W, horizonY - 30);
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();

      // Golden rim highlight along crest
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, horizonY);
      ctx.quadraticCurveTo(W * 0.25, horizonY - 45, W * 0.5, horizonY - 12);
      ctx.quadraticCurveTo(W * 0.78, horizonY + 20, W, horizonY - 30);
      ctx.stroke();
      ctx.restore();

      // Player Standing Victoriously on the Crest
      const heroX = W * 0.5;
      const heroY = horizonY - 34 + Math.sin(t * 2.2) * 2;
      const activeSkin = SHOP_SKINS.find(s => s.id === currentSkin.current) || SHOP_SKINS[0];
      ctx.save();
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 24;
      if (activeSkin.type === 'image') {
        const img = skinImages[activeSkin.id];
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, heroX - 30, heroY - 30, 60, 60);
        }
      } else {
        ctx.font = '54px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(activeSkin.value, heroX, heroY);
      }
      ctx.restore();

      // Gentle Golden Pollen & Leaves Floating Upward
      for (let p = 0; p < 34; p++) {
        const px = ((p * 173 + Math.sin(t + p) * 40) % W + W) % W;
        const py = ((H - ((t * 32 + p * 67) % H)) % H + H) % H;
        ctx.save();
        ctx.globalAlpha = 0.65;
        ctx.fillStyle = p % 3 === 0 ? '#4ade80' : '#fef08a';
        ctx.beginPath();
        ctx.arc(px, py, 2 + (p % 3), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // ACT V Memorial Crest (45.5s - 53.5s)
      if (t >= 45.5 && t < 54.0) {
        const fadeIn = Math.min(1, (t - 45.5) / 1.4);
        const fadeOut = t > 52.2 ? Math.max(0, 1 - (t - 52.2) / 1.8) : 1;
        ctx.save();
        ctx.globalAlpha = fadeIn * fadeOut;
        ctx.textAlign = 'center';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = '#a7f3d0';
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 14;
        ctx.fillText('✦ CALORIC CORRUPTION PURGED — 100% ✦', W * 0.5, H * 0.24);
        ctx.restore();
      }

      // ACT VI Final Curtain Title Card (54.0s - 60.0s)
      if (t >= 54.0) {
        const cardProg = Math.min(1, (t - 54.0) / 1.8);
        ctx.save();
        ctx.globalAlpha = cardProg;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Radiant glow behind title
        const titleGrad = ctx.createRadialGradient(W * 0.5, H * 0.38, 10, W * 0.5, H * 0.38, 360);
        titleGrad.addColorStop(0, 'rgba(251, 191, 36, 0.28)');
        titleGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = titleGrad;
        ctx.fillRect(0, 0, W, H);

        ctx.font = `900 ${Math.min(64, Math.floor(W * 0.055))}px Impact, sans-serif`;
        ctx.fillStyle = '#fef08a';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 28;
        ctx.fillText(`${bossTitle} VANQUISHED`, W * 0.5, H * 0.36);

        ctx.font = 'bold 20px sans-serif';
        ctx.fillStyle = '#86efac';
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 12;
        ctx.fillText('THE POWER OF NUTRITION PREVAILS', W * 0.5, H * 0.45);
        ctx.restore();
      }

      // Fade to black at very end (58.2s - 60.0s)
      if (t > 58.2) {
        const fadeBlack = Math.min(1, (t - 58.2) / 1.8);
        ctx.fillStyle = `rgba(2, 6, 23, ${fadeBlack})`;
        ctx.fillRect(-50, -50, W + 100, H + 100);
      }

      void localT;
    }

    // Expanding Cinematic Shockwave Rings (across any act)
    dc.rings.forEach(r => {
      const prog = r.radius / r.maxRadius;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - prog);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = Math.max(1.5, r.width * (1 - prog * 0.5));
      ctx.shadowColor = r.color;
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.arc(W * 0.5, H * 0.45, r.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    ctx.restore(); // End shake transform

    // -------------------------------------------------
    // WIDESCREEN 2.39:1 LETTERBOX BARS & SUBTITLES
    // -------------------------------------------------
    const targetBarH = Math.min(108, H * 0.14);
    const barH = t < 1.0 ? (t / 1.0) * targetBarH : targetBarH;
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, W, barH);
    ctx.fillRect(0, H - barH, W, barH);

    // Subtle Gold Cinema Trim
    ctx.fillStyle = 'rgba(251, 191, 36, 0.55)';
    ctx.fillRect(0, barH - 2, W, 2);
    ctx.fillRect(0, H - barH, W, 2);

    // Act Title & Dramatic Subtitle
    if (barH > 40) {
      let actTitle = 'ACT I — THE FATAL FRACTURE';
      let subtitle = modifiers.monkCartmanMode
        ? 'Monk Cartman: "IMPOSSIBLE! MY DISCIPLINE... SHATTERING?!"'
        : 'Gorgotolisis: "N-NO... IMPOSSIBLE! THE VITAMINS... THEY\'RE TEARING MY GREASE APART!"';

      if (t >= 10.0 && t < 22.0) {
        actTitle = 'ACT II — FALL OF THE JUNK REALM';
        subtitle = t < 16.0
          ? 'The grease of a thousand deep fryers unravels across the cracking sky...'
          : (modifiers.monkCartmanMode
            ? 'Monk Cartman: "MY HELICOPTER... MY AUTHORITAH... FALLING APART!"'
            : 'Gorgotolisis: "MY CALORIES... MY EMPIRE... YOU CANNOT ERASE ETERNAL FLAVOR!"');
      } else if (t >= 22.0 && t < 34.8) {
        actTitle = 'ACT III — THE NUTRITIONAL SINGULARITY';
        subtitle = t < 29.0
          ? 'Every deflected salad and ounce of discipline converges into a single blinding star...'
          : 'Gravitational purity collapses the core inward...';
      } else if (t >= 34.8 && t < 44.0) {
        actTitle = 'ACT IV — SUPERNOVA OF PURITY';
        subtitle = t < 37.5
          ? 'A blinding nova of pure nutrition washes over the collapsing realm!'
          : (modifiers.monkCartmanMode
            ? 'Monk Cartman: "Such... tranquility... I finally... understand..."'
            : 'Gorgotolisis: "So... light... I can finally... taste... the... fresh... air..."');
      } else if (t >= 44.0 && t < 54.0) {
        actTitle = 'ACT V — DAWN OF BALANCE';
        subtitle = 'The Junk Food Realm is cleansed. A golden dawn rises over the horizon.';
      } else if (t >= 54.0) {
        actTitle = 'FINALE — LEGENDARY VICTORY';
        subtitle = `${bossTitle} has fallen. Balance is restored forever.`;
      }

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '900 16px sans-serif';
      ctx.fillStyle = '#fbbf24';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 10;
      ctx.fillText(actTitle, W / 2, barH / 2);

      ctx.font = `600 ${Math.min(18, Math.max(13, Math.floor(W * 0.015)))}px sans-serif`;
      ctx.fillStyle = '#f8fafc';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 6;
      ctx.fillText(subtitle, W / 2, H - barH / 2);
      ctx.restore();
    }

    ctx.restore();
  };

  const drawPhase2Cutscene = (ctx: CanvasRenderingContext2D, W: number, H: number) => {
    const cut = phase2Cutscene.current;
    const t = cut.timer;
    const bossTitle = modifiers.monkCartmanMode ? 'MONK CARTMAN' : 'GORGOTOLISIS';
    const phase1Img = modifiers.breakingPoint ? breakingPointImage : (modifiers.monkCartmanMode ? helicopterImage : bossImage);
    const phase2Img = modifiers.breakingPoint ? breakingPointImage : (modifiers.monkCartmanMode ? helicopterImage : bossPhase2Image);

    ctx.save();
    ctx.fillStyle = '#070108';
    ctx.fillRect(0, 0, W, H);

    // Camera Shake
    let shakeAmt = 0;
    if (t < 0.8) shakeAmt = 20 * (1 - t / 0.8);
    else if (t >= 3.5 && t < 7.5) shakeAmt = 3 + ((t - 3.5) / 4.0) * 14;
    else if (t >= 8.1 && t < 10.6) shakeAmt = 34 * (1 - (t - 8.1) / 2.5);
    const shakeX = (Math.random() - 0.5) * shakeAmt;
    const shakeY = (Math.random() - 0.5) * shakeAmt;

    // -------------------------------------------------
    // COSMIC / VOLCANIC AWAKENING BACKDROP
    // -------------------------------------------------
    const awakProg = Math.max(0, Math.min(1, (t - 3.0) / 5.0));
    const bgGrad = ctx.createRadialGradient(W * 0.5, H * 0.45, 20, W * 0.5, H * 0.45, Math.max(W, H) * 0.85);
    if (t >= 8.1) {
      bgGrad.addColorStop(0, '#7c2d12');
      bgGrad.addColorStop(0.45, '#450a0a');
      bgGrad.addColorStop(1, '#050108');
    } else {
      bgGrad.addColorStop(0, awakProg > 0.3 ? '#581c87' : '#2a0617');
      bgGrad.addColorStop(0.5, '#1a0624');
      bgGrad.addColorStop(1, '#040107');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Stars
    cut.stars.forEach(st => {
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 2.5 + st.twinkle));
      ctx.fillStyle = t >= 8.1 ? '#fde68a' : '#e9d5ff';
      ctx.globalAlpha = tw * 0.7;
      ctx.beginPath();
      ctx.arc(st.x * W + shakeX * 0.2, st.y * H + shakeY * 0.2, st.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Molten Rising Embers
    cut.embers.forEach(em => {
      ctx.save();
      ctx.fillStyle = em.color;
      ctx.shadowColor = em.color;
      ctx.shadowBlur = 10;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.arc(em.x * W, em.y * H, em.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Cracked Volcanic Lightning Streaks during Awakening & Explosion (3.5s - 12s)
    if (t >= 3.5 && t < 12.5) {
      ctx.save();
      ctx.strokeStyle = t >= 8.1 ? 'rgba(251, 191, 36, 0.55)' : 'rgba(244, 63, 94, 0.5)';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 16;
      for (let k = 0; k < 4; k++) {
        if ((Math.floor(t * 9) + k) % 3 !== 0) continue;
        const lx = (0.15 + k * 0.23) * W;
        ctx.beginPath();
        ctx.moveTo(lx, 0);
        ctx.lineTo(lx + Math.sin(t * 15 + k) * 40, H * 0.25);
        ctx.lineTo(lx - Math.cos(t * 12 + k) * 45, H * 0.55);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // -------------------------------------------------
    // ACT I (0.0s - 3.5s): THE FALSE DEFEAT
    // -------------------------------------------------
    if (t < 3.5) {
      const bossCX = W * 0.5;
      const bossCY = H * 0.48 + Math.min(30, t * 10);
      const bossSize = 180 + t * 8;

      // Dimming red aura
      const auraGrad = ctx.createRadialGradient(bossCX, bossCY, 15, bossCX, bossCY, bossSize);
      auraGrad.addColorStop(0, 'rgba(239, 68, 68, 0.45)');
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(bossCX, bossCY, bossSize, 0, Math.PI * 2);
      ctx.fill();

      // Trembling Phase 1 Boss
      ctx.save();
      ctx.translate(bossCX + Math.sin(t * 50) * 4, bossCY);
      ctx.rotate(Math.sin(t * 4) * 0.08);
      if (Math.floor(t * 12) % 4 === 0) {
        ctx.filter = 'brightness(1.7) contrast(1.3) grayscale(0.4)';
      }
      if (phase1Img.complete && phase1Img.naturalWidth > 0) {
        ctx.drawImage(phase1Img, -bossSize / 2, -bossSize / 2, bossSize, bossSize);
      }
      ctx.restore();

      // Entry flash & manga impact lines (0.0s - 0.8s)
      if (t < 0.8) {
        ctx.fillStyle = `rgba(255, 255, 255, ${(1 - t / 0.8) * 0.8})`;
        ctx.fillRect(0, 0, W, H);
      }
    }

    // -------------------------------------------------
    // ACT II (3.5s - 8.1s): CALORIC AWAKENING & BIG MAC RITUAL
    // -------------------------------------------------
    else if (t < 8.1) {
      const localT = t - 3.5;
      const isCompressionBeat = t >= 7.5;
      const zoom = isCompressionBeat ? 1.45 - (t - 7.5) * 0.8 : 1.0 + (localT / 4.0) * 0.35;
      const bossCX = W * 0.5;
      const bossCY = H * 0.46;
      const bossSize = 185 * zoom;

      // Rising I-Ready Overdrive Ring
      const pctDisplay = Math.min(1000, Math.floor((localT / 3.8) * 1000));
      ctx.save();
      ctx.translate(bossCX, bossCY);
      ctx.rotate(t * 1.8);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 4;
      ctx.setLineDash([22, 12]);
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(0, 0, bossSize * 0.95, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.font = '900 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fde047';
      ctx.shadowColor = '#dc2626';
      ctx.shadowBlur = 12;
      ctx.fillText(`⚡ I-READY OVERDRIVE: ${pctDisplay}% ⚡`, bossCX, bossCY - bossSize * 0.78);
      ctx.restore();

      // 6 Spectral Big Macs channeling orange energy beams into Boss
      const hexR = Math.min(W, H) * (isCompressionBeat ? 0.14 : 0.32);
      for (let b = 0; b < 6; b++) {
        const ang = (b / 6) * Math.PI * 2 + t * 1.4;
        const bx = bossCX + Math.cos(ang) * hexR;
        const by = bossCY + Math.sin(ang) * hexR * 0.65;

        // Energy beam from Big Mac -> Boss core
        ctx.save();
        ctx.strokeStyle = 'rgba(251, 146, 60, 0.75)';
        ctx.lineWidth = 5;
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bossCX, bossCY);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(t * 3);
        ctx.globalAlpha = Math.min(1, localT / 0.8);
        if (bigMacImage.complete && bigMacImage.naturalWidth > 0) {
          ctx.drawImage(bigMacImage, -28, -28, 56, 56);
        } else {
          ctx.font = '40px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🍔', 0, 0);
        }
        ctx.restore();
      }

      // Boss glowing & charging inside vortex
      ctx.save();
      ctx.translate(bossCX + Math.sin(t * 58) * 5, bossCY);
      ctx.filter = `brightness(${1.2 + localT * 0.35}) contrast(1.4) saturate(1.8)`;
      if (phase1Img.complete && phase1Img.naturalWidth > 0) {
        ctx.drawImage(phase1Img, -bossSize / 2, -bossSize / 2, bossSize, bossSize);
      }
      ctx.restore();

      // Blinding core flare building up
      const coreR = 24 + localT * 18;
      const coreGrad = ctx.createRadialGradient(bossCX, bossCY, 2, bossCX, bossCY, coreR * 2);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.35, 'rgba(251, 191, 36, 0.85)');
      coreGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(bossCX, bossCY, coreR * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // -------------------------------------------------
    // ACT III & IV (8.1s - 15.0s): METAMORPHOSIS & ASCENDED REVEAL
    // -------------------------------------------------
    else {
      const post = t - 8.1;
      const isAct4 = t >= 11.2;
      const bossCX = W * 0.5;
      const bossCY = isAct4 ? H * 0.38 : H * 0.46;
      const bossSize = isAct4 ? 210 : 240;

      // Volumetric Crimson-Gold God-Rays behind Ascended Boss
      ctx.save();
      ctx.translate(bossCX, bossCY);
      ctx.rotate(t * 0.35);
      for (let r = 0; r < 12; r++) {
        ctx.save();
        ctx.rotate((r / 12) * Math.PI * 2);
        const rayGrad = ctx.createLinearGradient(0, 0, Math.max(W, H) * 0.8, 0);
        rayGrad.addColorStop(0, 'rgba(251, 191, 36, 0.42)');
        rayGrad.addColorStop(0.45, 'rgba(239, 68, 68, 0.16)');
        rayGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = rayGrad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.max(W, H) * 0.8, -42);
        ctx.lineTo(Math.max(W, H) * 0.8, 42);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      // Glowing Horizon & Player Confrontation in Act IV (11.2s - 15.0s)
      if (isAct4) {
        const horizY = H * 0.78;
        ctx.save();
        ctx.fillStyle = '#1c0a09';
        ctx.beginPath();
        ctx.moveTo(0, H);
        ctx.lineTo(0, horizY);
        ctx.quadraticCurveTo(W * 0.5, horizY - 35, W, horizY);
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.65)';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Player Silhouette Standing Brave Below
        const heroX = W * 0.5;
        const heroY = horizY - 34;
        const activeSkin = SHOP_SKINS.find(s => s.id === currentSkin.current) || SHOP_SKINS[0];
        ctx.shadowColor = '#4ade80';
        ctx.shadowBlur = 20;
        if (activeSkin.type === 'image') {
          const img = skinImages[activeSkin.id];
          if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, heroX - 28, heroY - 28, 56, 56);
          }
        } else {
          ctx.font = '48px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(activeSkin.value, heroX, heroY);
        }
        ctx.restore();
      }

      // Rotating Chromatic Halos around Ascended Boss
      ctx.save();
      ctx.translate(bossCX, bossCY);
      ctx.rotate(-t * 1.2);
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.ellipse(0, 0, bossSize * 0.75, bossSize * 0.35, 0.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.rotate(t * 2.4);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
      ctx.beginPath();
      ctx.ellipse(0, 0, bossSize * 0.82, bossSize * 0.38, -0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Phase 2 Ascended Boss Sprite
      ctx.save();
      ctx.translate(bossCX, bossCY + Math.sin(t * 3) * 8);
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 35;
      if (phase2Img.complete && phase2Img.naturalWidth > 0) {
        ctx.drawImage(phase2Img, -bossSize / 2, -bossSize / 2, bossSize, bossSize);
      }
      ctx.restore();

      // 6 Blazing Orbiting Big Macs around Ascended Boss
      const orbitR = bossSize * 0.9;
      for (let b = 0; b < 6; b++) {
        const ang = (b / 6) * Math.PI * 2 + t * 2.2;
        const bx = bossCX + Math.cos(ang) * orbitR;
        const by = bossCY + Math.sin(ang) * orbitR * 0.55;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(t * 3.5);
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 20;
        if (bigMacImage.complete && bigMacImage.naturalWidth > 0) {
          ctx.drawImage(bigMacImage, -34, -34, 68, 68);
        } else {
          ctx.font = '46px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🍔', 0, 0);
        }
        ctx.restore();
      }

      // Dramatic Title Reveal Banner in Act IV (11.2s - 15.0s)
      if (isAct4) {
        const bannerAlpha = Math.min(1, (t - 11.2) / 0.8);
        ctx.save();
        ctx.globalAlpha = bannerAlpha;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `900 ${Math.min(54, Math.floor(W * 0.048))}px Impact, sans-serif`;
        ctx.fillStyle = '#fef08a';
        ctx.shadowColor = '#dc2626';
        ctx.shadowBlur = 25;
        ctx.fillText(`⚡ PHASE 2: ASCENDED ${bossTitle} ⚡`, W * 0.5, H * 0.62);

        ctx.font = 'bold 18px sans-serif';
        ctx.fillStyle = '#fca5a5';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 10;
        ctx.fillText('BOW BEFORE THE BIG MAC ORBIT', W * 0.5, H * 0.68);
        ctx.restore();
      }

      // Initial Metamorphosis Flash Decay (8.1s - 9.8s)
      if (post < 1.7) {
        ctx.fillStyle = `rgba(255, 250, 230, ${(1 - post / 1.7) * 0.92})`;
        ctx.fillRect(-50, -50, W + 100, H + 100);
      }
    }

    // Shockwave Rings
    cut.rings.forEach(r => {
      const prog = r.radius / r.maxRadius;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - prog);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = Math.max(1.5, r.width * (1 - prog * 0.5));
      ctx.shadowColor = r.color;
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.arc(W * 0.5, H * 0.46, r.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    ctx.restore(); // end shake

    // -------------------------------------------------
    // WIDESCREEN LETTERBOX BARS & SUBTITLES
    // -------------------------------------------------
    const barH = cut.barHeight;
    if (barH > 0) {
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, W, barH);
      ctx.fillRect(0, H - barH, W, barH);

      ctx.fillStyle = 'rgba(245, 158, 11, 0.7)';
      ctx.fillRect(0, barH - 2, W, 2);
      ctx.fillRect(0, H - barH, W, 2);

      if (barH > 40) {
        let header = 'PHASE 2 TRANSFORMATION — THE FALSE DEFEAT';
        let subtitle = modifiers.monkCartmanMode
          ? 'Monk Cartman: "Heh... you actually thought that was my full authority?"'
          : 'Gorgotolisis: "Heh... you actually thought... that was the end?"';

        if (t >= 3.5 && t < 8.1) {
          header = 'PHASE 2 TRANSFORMATION — CALORIC AWAKENING';
          subtitle = modifiers.monkCartmanMode
            ? 'Monk Cartman: "MY DISCIPLINE IS ASCENDING BEYOND MORTAL LIMITS!"'
            : 'Gorgotolisis: "MY CHOLESTEROL IS ASCENDING BEYOND MORTAL LIMITS!"';
        } else if (t >= 8.1 && t < 11.2) {
          header = `⚡ PHASE 2: ASCENDED ${bossTitle} ⚡`;
          subtitle = '"BEHOLD MY TRUE FORM! THE CALORIC DOMAIN IS REBORN!"';
        } else if (t >= 11.2) {
          header = `⚡ PHASE 2: ASCENDED ${bossTitle} ⚡`;
          subtitle = '"THE CALORIC DOMAIN IS REBORN! BOW BEFORE THE BIG MAC ORBIT!"';
        }

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '900 18px sans-serif';
        ctx.fillStyle = '#f59e0b';
        ctx.shadowColor = '#dc2626';
        ctx.shadowBlur = 12;
        ctx.fillText(header, W / 2, barH / 2);

        ctx.font = `600 ${Math.min(18, Math.max(13, Math.floor(W * 0.015)))}px sans-serif`;
        ctx.fillStyle = '#fef08a';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 8;
        ctx.fillText(subtitle, W / 2, H - barH / 2);
        ctx.restore();
      }
    }

    ctx.restore();
  };

  const drawPhase3Cutscene = (ctx: CanvasRenderingContext2D, W: number, H: number) => {
    const cut = phase3Cutscene.current;
    const t = cut.timer;
    const bossTitle = modifiers.monkCartmanMode ? 'MONK CARTMAN' : 'GORGOTOLISIS';
    const phase2Img = modifiers.breakingPoint ? breakingPointImage : (modifiers.monkCartmanMode ? helicopterImage : bossPhase2Image);
    const phase3Img = modifiers.monkCartmanMode ? helicopterImage : bossPhase3Image;

    const drawCutsceneFood = (foodIdx: number, size: number) => {
      const idx = ((foodIdx % 14) + 14) % 14;
      let img: HTMLImageElement | null = null;
      let emoji = '🍔';
      switch (idx) {
        case 0: emoji = '🍔'; break;
        case 1: emoji = '🍟'; break;
        case 2: emoji = '🥤'; break;
        case 3: emoji = '🍕'; break;
        case 4: emoji = '🍩'; break;
        case 5: emoji = '🌭'; break;
        case 6: img = junkFoodImage; emoji = '🍗'; break;
        case 7: img = oreoImage; emoji = '🍪'; break;
        case 8: img = chefImage; emoji = '🥫'; break;
        case 9: img = oatmealImage; emoji = '🍪'; break;
        case 10: img = dongfishImage; emoji = '🐟'; break;
        case 11: img = bigMacImage; emoji = '🍔'; break;
        case 12: img = cherryCokeImage; emoji = '🥤'; break;
        case 13: img = creamPepsiImage; emoji = '🥤'; break;
      }
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.48, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, -size * 0.52, -size * 0.52, size * 1.04, size * 1.04);
      } else {
        ctx.font = `${Math.round(size * 0.9)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emoji, 0, 0);
      }
    };

    ctx.save();
    ctx.fillStyle = '#04010a';
    ctx.fillRect(0, 0, W, H);

    // Camera Shake
    let shakeAmt = 0;
    if (t < 1.0) shakeAmt = 24 * (1 - t / 1.0);
    else if (t >= 2.8 && t < 9.2) shakeAmt = 4 + ((t - 2.8) / 6.4) * 18;
    else if (t >= 9.2 && t < 11.8) shakeAmt = 42 * (1 - (t - 9.2) / 2.6);
    const shakeX = (Math.random() - 0.5) * shakeAmt;
    const shakeY = (Math.random() - 0.5) * shakeAmt;

    // Cosmic Violet-Crimson Singularity Backdrop
    const bgGrad = ctx.createRadialGradient(W * 0.5, H * 0.46, 20, W * 0.5, H * 0.46, Math.max(W, H) * 0.9);
    if (t >= 9.2) {
      bgGrad.addColorStop(0, '#581c87');
      bgGrad.addColorStop(0.42, '#450a0a');
      bgGrad.addColorStop(1, '#030007');
    } else if (t >= 2.8) {
      bgGrad.addColorStop(0, '#3b0764');
      bgGrad.addColorStop(0.5, '#1e062c');
      bgGrad.addColorStop(1, '#020005');
    } else {
      bgGrad.addColorStop(0, '#450a0a');
      bgGrad.addColorStop(0.55, '#19051d');
      bgGrad.addColorStop(1, '#030106');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Cosmic Stars
    cut.stars.forEach(st => {
      const tw = 0.3 + 0.7 * Math.abs(Math.sin(t * 3 + st.twinkle));
      ctx.fillStyle = t >= 9.2 ? '#f5d0fe' : '#fde68a';
      ctx.globalAlpha = tw * 0.78;
      ctx.beginPath();
      ctx.arc(st.x * W + shakeX * 0.2, st.y * H + shakeY * 0.2, st.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    const bossCX = W * 0.5;
    const bossCY = t >= 12.0 ? H * 0.39 : H * 0.46;

    // -------------------------------------------------
    // ACT I (0.0s - 2.8s): ASCENDED FORM SHATTERS
    // -------------------------------------------------
    if (t < 2.8) {
      const bossSize = 205 + t * 10;
      ctx.save();
      ctx.translate(bossCX + Math.sin(t * 60) * 5, bossCY);
      ctx.rotate(Math.sin(t * 5) * 0.08);
      if (Math.floor(t * 14) % 3 === 0) {
        ctx.filter = 'brightness(1.8) hue-rotate(40deg) contrast(1.4)';
      }
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 30;
      if (phase2Img.complete && phase2Img.naturalWidth > 0) {
        ctx.drawImage(phase2Img, -bossSize / 2, -bossSize / 2, bossSize, bossSize);
      }
      ctx.restore();

      // Violet energy fractures across Ascended Gorgotolisis
      ctx.save();
      ctx.strokeStyle = '#e879f9';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 18;
      for (let f = 0; f < 6; f++) {
        const a = (f / 6) * Math.PI * 2 + 0.3;
        const reach = Math.min(1, t / 2.2) * bossSize * 0.75;
        ctx.beginPath();
        ctx.moveTo(bossCX, bossCY);
        ctx.lineTo(bossCX + Math.cos(a) * reach * 0.5 + Math.sin(t * 20 + f) * 12, bossCY + Math.sin(a) * reach * 0.5);
        ctx.lineTo(bossCX + Math.cos(a) * reach, bossCY + Math.sin(a) * reach);
        ctx.stroke();
      }
      ctx.restore();

      if (t < 0.75) {
        ctx.fillStyle = `rgba(255, 255, 255, ${(1 - t / 0.75) * 0.85})`;
        ctx.fillRect(-50, -50, W + 100, H + 100);
      }
    }

    // -------------------------------------------------
    // ACT II (2.8s - 9.2s): ABSORBING TRILLIONS OF CALORIES OF FOOD
    // -------------------------------------------------
    else if (t < 9.2) {
      const localT = t - 2.8;
      const prog = Math.min(1, localT / 6.4);
      const bossSize = 215 + prog * 45;
      const maxSpan = Math.max(W, H) * 0.65;

      // Gravity Accretion Vortex Disc
      ctx.save();
      ctx.translate(bossCX, bossCY);
      ctx.rotate(t * 2.2);
      for (let r = 0; r < 3; r++) {
        ctx.strokeStyle = r === 0 ? 'rgba(192, 132, 252, 0.55)' : r === 1 ? 'rgba(251, 191, 36, 0.5)' : 'rgba(239, 68, 68, 0.45)';
        ctx.lineWidth = 4;
        ctx.setLineDash([28, 16]);
        ctx.beginPath();
        ctx.ellipse(0, 0, bossSize * (0.95 + r * 0.35), bossSize * (0.45 + r * 0.16), r * 0.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // 140+ Swirling Junk Foods + Absorption Beams Sucked Into Gorgotolisis
      cut.swirlingFoods.forEach((sf, i) => {
        const rx = bossCX + Math.cos(sf.angle) * sf.dist * maxSpan;
        const ry = bossCY + Math.sin(sf.angle) * sf.dist * maxSpan * 0.72;
        if (i % 5 === 0) {
          ctx.save();
          ctx.strokeStyle = sf.color;
          ctx.globalAlpha = 0.25 + (1 - Math.min(1, sf.dist)) * 0.45;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(bossCX, bossCY);
          ctx.stroke();
          ctx.restore();
        }
        ctx.save();
        ctx.translate(rx, ry);
        ctx.rotate(sf.rot);
        ctx.globalAlpha = Math.min(1, sf.dist * 3.5);
        drawCutsceneFood(sf.foodIdx, sf.size);
        ctx.restore();
      });

      // Ascended Gorgotolisis swelling with cosmic caloric overload
      ctx.save();
      ctx.translate(bossCX + Math.sin(t * 62) * 5, bossCY);
      ctx.filter = `brightness(${1.15 + prog * 0.65}) contrast(1.4) saturate(1.7)`;
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 45;
      if (phase2Img.complete && phase2Img.naturalWidth > 0) {
        ctx.drawImage(phase2Img, -bossSize / 2, -bossSize / 2, bossSize, bossSize);
      }
      ctx.restore();

      // Singularity Core & Live Trillion-Calorie Counter
      const coreR = 26 + prog * 56;
      const coreGrad = ctx.createRadialGradient(bossCX, bossCY, 2, bossCX, bossCY, coreR * 2.2);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.35, 'rgba(216, 180, 254, 0.9)');
      coreGrad.addColorStop(0.7, 'rgba(245, 158, 11, 0.45)');
      coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(bossCX, bossCY, coreR * 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Exponentially escalating Trillion Calorie readout
      const trillions = Math.pow(prog, 2.2) * 14.872;
      const kcalCount = Math.floor(trillions * 1_000_000_000_000);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = `900 ${Math.min(24, Math.max(15, Math.floor(W * 0.022)))}px monospace`;
      ctx.fillStyle = '#fde047';
      ctx.shadowColor = '#7e22ce';
      ctx.shadowBlur = 16;
      ctx.fillText(`⚡ ABSORBING: ${kcalCount.toLocaleString()} kcal ⚡`, bossCX, bossCY - bossSize * 0.72);
      ctx.font = '800 13px sans-serif';
      ctx.fillStyle = '#e9d5ff';
      ctx.fillText('ALL JUNK FOOD IN THE COSMOS CONVERGING', bossCX, bossCY - bossSize * 0.72 + 24);
      ctx.restore();
    }

    // -------------------------------------------------
    // ACT III & IV (9.2s - 16.0s): STAGE 3 — CALORIES UNLEASHED + MINIGUN REVEAL
    // -------------------------------------------------
    else {
      const post = t - 9.2;
      const isAct4 = t >= 12.0;
      const bossSize = isAct4 ? 225 : 250;

      // Cosmic Violet-Crimson-Gold God-Rays
      ctx.save();
      ctx.translate(bossCX, bossCY);
      ctx.rotate(t * 0.48);
      for (let r = 0; r < 16; r++) {
        ctx.save();
        ctx.rotate((r / 16) * Math.PI * 2);
        const rayGrad = ctx.createLinearGradient(0, 0, Math.max(W, H) * 0.85, 0);
        rayGrad.addColorStop(0, r % 2 === 0 ? 'rgba(192, 132, 252, 0.48)' : 'rgba(251, 191, 36, 0.42)');
        rayGrad.addColorStop(0.5, 'rgba(239, 68, 68, 0.16)');
        rayGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = rayGrad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.max(W, H) * 0.85, -36);
        ctx.lineTo(Math.max(W, H) * 0.85, 36);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      // Rotating Stage 3 Halo Rings
      ctx.save();
      ctx.translate(bossCX, bossCY);
      ctx.rotate(-t * 1.5);
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 4.5;
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.ellipse(0, 0, bossSize * 0.82, bossSize * 0.36, 0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.rotate(t * 3.0);
      ctx.strokeStyle = '#fbbf24';
      ctx.beginPath();
      ctx.ellipse(0, 0, bossSize * 0.88, bossSize * 0.4, -0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Stage 3 Boss Image (https://i.postimg.cc/3r6Zhyrh/image.png)
      ctx.save();
      ctx.translate(bossCX, bossCY + Math.sin(t * 3.5) * 7);
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 42;
      if (phase3Img.complete && phase3Img.naturalWidth > 0) {
        ctx.drawImage(phase3Img, -bossSize / 2, -bossSize / 2, bossSize, bossSize);
      } else if (phase2Img.complete && phase2Img.naturalWidth > 0) {
        ctx.drawImage(phase2Img, -bossSize / 2, -bossSize / 2, bossSize, bossSize);
      }

      // Spinning 6-Barrel Calorie Minigun Mounted on Stage 3 Boss
      ctx.save();
      ctx.translate(bossSize * 0.34, bossSize * 0.16);
      ctx.rotate(0.18);
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 3;
      ctx.fillRect(-14, -18, 44, 36);
      ctx.strokeRect(-14, -18, 44, 36);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(4, 24, 15, 0, Math.PI * 2);
      ctx.fill();
      for (let b = 0; b < 6; b++) {
        const yOff = Math.sin(t * 28 + b * (Math.PI / 3)) * 11;
        ctx.fillStyle = b % 2 === 0 ? '#cbd5e1' : '#64748b';
        ctx.fillRect(30, yOff - 2.5, 58, 5);
      }
      if (isAct4) {
        ctx.fillStyle = '#fef08a';
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.arc(92, 0, 14 + Math.sin(t * 60) * 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.restore();

      // Act IV Title Banner + Player Confrontation Silhouette
      if (isAct4) {
        const bannerAlpha = Math.min(1, (t - 12.0) / 0.65);
        ctx.save();
        ctx.globalAlpha = bannerAlpha;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `900 ${Math.min(52, Math.floor(W * 0.045))}px Impact, sans-serif`;
        ctx.fillStyle = '#f5d0fe';
        ctx.shadowColor = '#7e22ce';
        ctx.shadowBlur = 28;
        ctx.fillText(`🔥 STAGE 3: ${bossTitle}, CALORIES UNLEASHED 🔥`, W * 0.5, H * 0.66);

        ctx.font = '900 18px sans-serif';
        ctx.fillStyle = '#fde047';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 12;
        ctx.fillText('TRILLIONS OF CALORIES ABSORBED • 55 RPS JUNK-FOOD MINIGUN ARMED', W * 0.5, H * 0.725);
        ctx.restore();
      }

      if (post < 1.8) {
        ctx.fillStyle = `rgba(248, 232, 255, ${(1 - post / 1.8) * 0.94})`;
        ctx.fillRect(-50, -50, W + 100, H + 100);
      }
    }

    // Shockwave Rings
    cut.rings.forEach(r => {
      const prog = Math.min(1, Math.max(0, r.radius / Math.max(1, r.maxRadius)));
      ctx.save();
      ctx.globalAlpha = r.speed > 0 ? Math.max(0, 1 - prog) : 0.7;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = Math.max(2, r.width * (r.speed > 0 ? (1 - prog * 0.45) : 1));
      ctx.shadowColor = r.color;
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.arc(bossCX, H * 0.46, Math.max(4, r.radius), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    ctx.restore(); // end shake

    // Widescreen Letterbox Bars & Subtitles
    const barH = cut.barHeight;
    if (barH > 0) {
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, W, barH);
      ctx.fillRect(0, H - barH, W, barH);

      ctx.fillStyle = 'rgba(192, 132, 252, 0.8)';
      ctx.fillRect(0, barH - 2, W, 2);
      ctx.fillRect(0, H - barH, W, 2);

      if (barH > 40) {
        let header = 'STAGE 3 AWAKENING — THE FINAL LIMIT BREAKS';
        let subtitle = `${modifiers.monkCartmanMode ? 'Monk Cartman' : 'Gorgotolisis'}: "NO... I REFUSE TO BURN A SINGLE CALORIE!"`;

        if (t >= 2.8 && t < 9.2) {
          header = 'STAGE 3 — ABSORBING TRILLIONS OF CALORIES';
          subtitle = `${modifiers.monkCartmanMode ? 'Monk Cartman' : 'Gorgotolisis'}: "COME TO ME... EVERY BURGER, SODA, DONUT, AND FEAST IN EXISTENCE!"`;
        } else if (t >= 9.2 && t < 12.0) {
          header = `🔥 STAGE 3: ${bossTitle}, CALORIES UNLEASHED 🔥`;
          subtitle = '"FOURTEEN TRILLION KILOCALORIES... NOW COMPRESSED INTO PURE ANNIHILATION!"';
        } else if (t >= 12.0) {
          header = `🔥 STAGE 3: ${bossTitle}, CALORIES UNLEASHED 🔥`;
          subtitle = '"MEET MY CALORIE MINIGUN! FIFTY-FIVE ROUNDS OF PURE JUNK FOOD EVERY SECOND!"';
        }

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '900 18px sans-serif';
        ctx.fillStyle = '#e879f9';
        ctx.shadowColor = '#7e22ce';
        ctx.shadowBlur = 12;
        ctx.fillText(header, W / 2, barH / 2);

        ctx.font = `600 ${Math.min(18, Math.max(13, Math.floor(W * 0.015)))}px sans-serif`;
        ctx.fillStyle = '#fef08a';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 8;
        ctx.fillText(subtitle, W / 2, H - barH / 2);
        ctx.restore();
      }
    }

    ctx.restore();
  };

  const drawEntranceCutscene = (ctx: CanvasRenderingContext2D, W: number, H: number) => {
    const ec = entranceCutscene.current;
    const t = ec.timer;
    const bossImg = modifiers.breakingPoint ? breakingPointImage : bossImage;

    // Camera Shake (heavy wind rumble during freefall, huge spike at 18.5s touchdown)
    let shakeAmt = 0;
    if (t >= 5.5 && t < 12.5) shakeAmt = 5;
    else if (t >= 18.5 && t < 20.6) shakeAmt = 36 * (1 - (t - 18.5) / 2.1);
    const shakeX = (Math.random() - 0.5) * shakeAmt;
    const shakeY = (Math.random() - 0.5) * shakeAmt;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // -------------------------------------------------
    // STRATOSPHERIC SKY GRADIENT (Twilight -> Sunset -> Ground)
    // -------------------------------------------------
    const descentProg = Math.min(1, t / 18.5);
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    if (t < 12.5) {
      skyGrad.addColorStop(0, '#071129');
      skyGrad.addColorStop(0.45, '#1e40af');
      skyGrad.addColorStop(0.82, '#ea580c');
      skyGrad.addColorStop(1, '#fbbf24');
    } else {
      skyGrad.addColorStop(0, '#0f172a');
      skyGrad.addColorStop(0.55, '#7c2d12');
      skyGrad.addColorStop(0.8, '#c2410c');
      skyGrad.addColorStop(1, '#1e293b');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(-50, -50, W + 100, H + 100);

    // Rushing Cloud Banks (Acts I & II)
    if (t < 13.0) {
      ec.clouds.forEach(c => {
        ctx.save();
        ctx.globalAlpha = c.alpha * (t > 11.5 ? Math.max(0, 1 - (t - 11.5) / 1.5) : 1);
        ctx.fillStyle = c.layer === 0 ? '#fed7aa' : c.layer === 1 ? '#fdba74' : '#93c5fd';
        ctx.beginPath();
        ctx.ellipse(c.x * W, c.y * H, c.rx * W, c.ry * H, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    // High-Speed Vertical Wind Streams rushing upward (0s - 18.5s)
    if (t < 18.5) {
      const windAlphaScale = t >= 12.5 ? 0.55 : 0.9;
      ctx.save();
      ec.windStreaks.forEach(ws => {
        ctx.strokeStyle = `rgba(255, 255, 255, ${ws.alpha * windAlphaScale})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ws.x * W, ws.y * H);
        ctx.lineTo(ws.x * W, ws.y * H + ws.len * H);
        ctx.stroke();
      });
      ctx.restore();
    }

    // -------------------------------------------------
    // ACT 1 (0.0s - 5.5s): RADAR LOCK & ATMOSPHERIC BREACH
    // -------------------------------------------------
    if (t < 5.5) {
      const localP = t / 5.5;
      const meteorX = W * 0.5 + Math.sin(t * 2.5) * 35;
      const meteorY = H * (0.12 + localP * 0.48);

      // Blazing Atmospheric Entry Cone High in Clouds
      const coneGrad = ctx.createRadialGradient(meteorX, meteorY, 8, meteorX, meteorY, 170);
      coneGrad.addColorStop(0, '#ffffff');
      coneGrad.addColorStop(0.25, '#fde047');
      coneGrad.addColorStop(0.6, 'rgba(249, 115, 22, 0.45)');
      coneGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.arc(meteorX, meteorY, 170, 0, Math.PI * 2);
      ctx.fill();

      // Glowing flame tail stretching upward
      const tailGrad = ctx.createLinearGradient(meteorX, meteorY - 380, meteorX, meteorY);
      tailGrad.addColorStop(0, 'rgba(251, 146, 60, 0)');
      tailGrad.addColorStop(1, 'rgba(254, 240, 138, 0.85)');
      ctx.fillStyle = tailGrad;
      ctx.beginPath();
      ctx.moveTo(meteorX - 65, meteorY - 380);
      ctx.lineTo(meteorX + 65, meteorY - 380);
      ctx.lineTo(meteorX + 18, meteorY);
      ctx.lineTo(meteorX - 18, meteorY);
      ctx.closePath();
      ctx.fill();

      // Small silhouette growing inside meteor
      const silSize = 42 + localP * 55;
      ctx.save();
      ctx.translate(meteorX, meteorY);
      ctx.filter = 'brightness(0.25) sepia(1) hue-rotate(-30deg) saturate(4)';
      if (bossImg.complete && bossImg.naturalWidth > 0) {
        ctx.drawImage(bossImg, -silSize / 2, -silSize / 2, silSize, silSize);
      }
      ctx.restore();

      // Tactical targeting box tracking the meteor
      ctx.save();
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 2;
      const boxR = 85 - localP * 15;
      ctx.strokeRect(meteorX - boxR, meteorY - boxR, boxR * 2, boxR * 2);
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#4ade80';
      ctx.textAlign = 'left';
      ctx.fillText('LOCKED: CALORIC METEOR', meteorX + boxR + 10, meteorY - 6);
      ctx.fillText(`MASS: OVER 9,000,000 KCAL`, meteorX + boxR + 10, meteorY + 12);
      ctx.restore();
    }

    // -------------------------------------------------
    // ACT 2 (5.5s - 12.5s): FREEFALL CAM — RIDING THE ROTISSERIE COMET
    // -------------------------------------------------
    else if (t < 12.5) {
      const bossCX = W * 0.5 + Math.sin(t * 2.1) * 45;
      const bossCY = H * 0.44 + Math.cos(t * 3.0) * 14;
      const bossSize = 185;

      // Giant Flame Wake shooting UPWARD above him
      const wakeGrad = ctx.createLinearGradient(bossCX, bossCY - 420, bossCX, bossCY + 90);
      wakeGrad.addColorStop(0, 'rgba(249, 115, 22, 0)');
      wakeGrad.addColorStop(0.65, 'rgba(245, 158, 11, 0.55)');
      wakeGrad.addColorStop(1, 'rgba(254, 249, 195, 0.95)');
      ctx.fillStyle = wakeGrad;
      ctx.beginPath();
      ctx.moveTo(bossCX - 150, bossCY - 420);
      ctx.lineTo(bossCX + 150, bossCY - 420);
      ctx.lineTo(bossCX + 95, bossCY + 80);
      ctx.lineTo(bossCX - 95, bossCY + 80);
      ctx.closePath();
      ctx.fill();

      // Supersonic Parabolic Mach Shock Cone underneath
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.moveTo(bossCX - 230, bossCY - 70);
      ctx.quadraticCurveTo(bossCX, bossCY + 240, bossCX + 230, bossCY - 70);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(bossCX - 280, bossCY - 110);
      ctx.quadraticCurveTo(bossCX, bossCY + 290, bossCX + 280, bossCY - 110);
      ctx.stroke();
      ctx.restore();

      // Giant Rotisserie Chicken surfing beneath Gorgotolisis
      ctx.save();
      ctx.translate(bossCX, bossCY + 58);
      ctx.rotate(Math.sin(t * 4) * 0.08);
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 32;
      if (junkFoodImage.complete && junkFoodImage.naturalWidth > 0) {
        ctx.drawImage(junkFoodImage, -110, -70, 220, 140);
      } else {
        ctx.font = '120px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🍗', 0, 0);
      }
      ctx.restore();

      // Gorgotolisis standing atop the Rotisserie Chicken
      ctx.save();
      ctx.translate(bossCX, bossCY - 22);
      ctx.rotate(Math.sin(t * 3) * 0.05);
      if (bossImg.complete && bossImg.naturalWidth > 0) {
        ctx.drawImage(bossImg, -bossSize / 2, -bossSize / 2, bossSize, bossSize);
      }
      ctx.restore();

      // Crispy Grease Sparks flying upward
      ec.greaseSparks.forEach(g => {
        ctx.save();
        ctx.fillStyle = g.color;
        ctx.shadowColor = g.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(g.x * W, g.y * H, g.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    // -------------------------------------------------
    // ACT 3 & 4 (12.5s - 22.0s): GROUND HORIZON IMPACT & TOUCHDOWN REVEAL
    // -------------------------------------------------
    else {
      const horizY = H * 0.72;
      const landX = W * 0.5;
      const landY = horizY - 30;

      // Ground Arena Plane
      ctx.save();
      const groundGrad = ctx.createLinearGradient(0, horizY, 0, H);
      groundGrad.addColorStop(0, '#334155');
      groundGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, horizY, W, H - horizY);

      // Perspective Grid Lines on Ground
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = 2;
      for (let g = -6; g <= 6; g++) {
        ctx.beginPath();
        ctx.moveTo(W * 0.5 + g * 80, horizY);
        ctx.lineTo(W * 0.5 + g * 240, H);
        ctx.stroke();
      }
      for (let r = 1; r <= 4; r++) {
        const gy = horizY + (r / 4) * (H - horizY);
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(W, gy);
        ctx.stroke();
      }
      ctx.restore();

      // Pulsing Impact Zone Target Reticle on Ground (12.5s - 18.5s)
      if (t < 18.5) {
        const pulse = 1 + Math.sin(t * 14) * 0.12;
        ctx.save();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.ellipse(landX, landY + 25, 130 * pulse, 34 * pulse, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = '900 14px monospace';
        ctx.fillStyle = '#fca5a5';
        ctx.textAlign = 'center';
        ctx.fillText('⚠ IMPACT ZONE ⚠', landX, landY + 75);
        ctx.restore();
      }

      // Player Standing Ready in Foreground Looking Up
      const heroX = W * 0.22;
      const heroY = H * 0.84;
      const activeSkin = SHOP_SKINS.find(s => s.id === currentSkin.current) || SHOP_SKINS[0];
      ctx.save();
      ctx.shadowColor = '#4ade80';
      ctx.shadowBlur = 18;
      if (activeSkin.type === 'image') {
        const img = skinImages[activeSkin.id];
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, heroX - 30, heroY - 30, 60, 60);
        }
      } else {
        ctx.font = '54px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(activeSkin.value, heroX, heroY);
      }
      ctx.restore();

      if (t < 18.5) {
        // Diving Gorgotolisis plummeting straight down from sky
        const dropP = (t - 12.5) / 6.0;
        const curY = -120 + (landY + 80) * (dropP * dropP);
        const curSize = 80 + dropP * 130;

        // Vertical meteor streak
        const streakG = ctx.createLinearGradient(landX, 0, landX, curY);
        streakG.addColorStop(0, 'rgba(249, 115, 22, 0)');
        streakG.addColorStop(1, 'rgba(254, 240, 138, 0.9)');
        ctx.fillStyle = streakG;
        ctx.fillRect(landX - 28, 0, 56, Math.max(0, curY));

        ctx.save();
        ctx.translate(landX, curY);
        if (junkFoodImage.complete && junkFoodImage.naturalWidth > 0) {
          ctx.drawImage(junkFoodImage, -curSize * 0.45, curSize * 0.12, curSize * 0.9, curSize * 0.55);
        }
        if (bossImg.complete && bossImg.naturalWidth > 0) {
          ctx.drawImage(bossImg, -curSize / 2, -curSize / 2, curSize, curSize);
        }
        ctx.restore();
      } else {
        // 18.5s - 22.0s: TOUCHDOWN SHOCKWAVE + CRATER + DOSSIER CARD
        const post = t - 18.5;

        // Cracked Impact Crater
        ctx.save();
        ctx.fillStyle = '#090d16';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(landX, landY + 35, 190, 48, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Expanding Dual Golden Shockwaves
        for (let s = 0; s < 2; s++) {
          const swP = Math.min(1, post / (1.4 + s * 0.5));
          if (swP < 1) {
            ctx.save();
            ctx.globalAlpha = 1 - swP;
            ctx.strokeStyle = s === 0 ? '#fef08a' : '#f97316';
            ctx.lineWidth = 10 * (1 - swP);
            ctx.beginPath();
            ctx.ellipse(landX, landY + 25, 60 + swP * W * 0.7, 20 + swP * 180, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        }

        // Boss standing tall out of the smoke
        const riseY = landY - 35 - Math.min(20, post * 18);
        const bossSize = 215;
        ctx.save();
        ctx.translate(landX, riseY);
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 35;
        if (bossImg.complete && bossImg.naturalWidth > 0) {
          ctx.drawImage(bossImg, -bossSize / 2, -bossSize / 2, bossSize, bossSize);
        }
        ctx.restore();

        // Tactical Boss Dossier Title Banner (19.2s - 22.0s)
        if (post > 0.7) {
          const cardA = Math.min(1, (post - 0.7) / 0.6);
          ctx.save();
          ctx.globalAlpha = cardA;
          ctx.textAlign = 'center';
          ctx.font = `900 ${Math.min(54, Math.floor(W * 0.048))}px Impact, sans-serif`;
          ctx.fillStyle = '#fde047';
          ctx.shadowColor = '#ea580c';
          ctx.shadowBlur = 22;
          ctx.fillText('GORGOTOLISIS', W * 0.5, H * 0.25);

          ctx.font = 'bold 18px monospace';
          ctx.fillStyle = '#fed7aa';
          ctx.shadowColor = '#000000';
          ctx.shadowBlur = 8;
          ctx.fillText('THE JUNK FOOD DEMON — ROTISSERIE DROP COMPLETE', W * 0.5, H * 0.32);
          ctx.restore();
        }

        // Brief Touchdown Impact Flash
        if (post < 0.45) {
          ctx.fillStyle = `rgba(255, 250, 220, ${(1 - post / 0.45) * 0.85})`;
          ctx.fillRect(-50, -50, W + 100, H + 100);
        }
      }
    }

    ctx.restore(); // End shake

    // -------------------------------------------------
    // TACTICAL SKYCAM RADAR HUD & WIDESCREEN BARS
    // -------------------------------------------------
    const barH = Math.min(82, H * 0.11);
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, W, barH);
    ctx.fillRect(0, H - barH, W, barH);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, barH - 2, W, 2);
    ctx.fillRect(0, H - barH, W, 2);

    // Corner Tactical Brackets
    ctx.save();
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.7)';
    ctx.lineWidth = 2;
    const pad = 22;
    const blen = 28;
    const topY = barH + pad;
    const botY = H - barH - pad;
    // Top-left, Top-right, Bottom-left, Bottom-right
    ctx.beginPath();
    ctx.moveTo(pad, topY + blen); ctx.lineTo(pad, topY); ctx.lineTo(pad + blen, topY);
    ctx.moveTo(W - pad - blen, topY); ctx.lineTo(W - pad, topY); ctx.lineTo(W - pad, topY + blen);
    ctx.moveTo(pad, botY - blen); ctx.lineTo(pad, botY); ctx.lineTo(pad + blen, botY);
    ctx.moveTo(W - pad - blen, botY); ctx.lineTo(W - pad, botY); ctx.lineTo(W - pad, botY - blen);
    ctx.stroke();

    // Live Altitude & Velocity Readout (Top-Left inside view)
    const altFeet = Math.max(0, Math.floor((1 - descentProg) * 22000));
    const mach = t < 18.5 ? (1.8 + Math.sin(t * 3) * 0.25 + descentProg * 1.1).toFixed(1) : '0.0';
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#4ade80';
    ctx.textAlign = 'left';
    ctx.fillText(`ALT: ${altFeet.toLocaleString()} FT`, pad + 14, topY + 24);
    ctx.fillText(`VEL: MACH ${mach}`, pad + 14, topY + 44);
    ctx.fillStyle = t >= 18.5 ? '#fde047' : '#fb923c';
    ctx.fillText(t >= 18.5 ? 'STATUS: IMPACT CONFIRMED' : 'STATUS: ATMOSPHERIC ENTRY', pad + 14, topY + 64);

    // Header & Dramatic Subtitles in Letterbox Bars
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 16px sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('🍗 INCOMING THREAT: STRATOSPHERIC ROTISSERIE DROP', W / 2, barH / 2);

    let sub = 'RADAR WARNING: MASSIVE GREASE SIGNATURE BREACHING UPPER ATMOSPHERE...';
    if (t >= 5.5 && t < 12.5) {
      sub = 'Gorgotolisis: "ORDER UP, MORTAL! EXPRESS DELIVERY FROM THE DEEP FRYER HEAVENS!"';
    } else if (t >= 12.5 && t < 18.5) {
      sub = 'BRACE FOR IMPACT! GORGOTOLISIS IS LOCKED ONTO THE ARENA!';
    } else if (t >= 18.5) {
      sub = 'Gorgotolisis: "NOW... LET THE FEAST BEGIN!"';
    }
    ctx.font = `600 ${Math.min(17, Math.max(12, Math.floor(W * 0.014)))}px sans-serif`;
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(sub, W / 2, H - barH / 2);
    ctx.restore();
  };

  const drawImpactFrameOverlay = (
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    cameraX = 0,
    cameraY = 0
  ) => {
    const imp = impactFrame.current;
    if (!imp.active) return;

    const prog = Math.min(1, imp.timer / Math.max(0.01, imp.duration));
    let fx = W * 0.5;
    let fy = H * 0.5;

    if (imp.isScreenCoord) {
      fx = imp.x;
      fy = imp.y;
    } else if (modifiers.mode3D) {
      const dx = imp.x - player.current.x;
      const dy = imp.y - player.current.y;
      const sinA = Math.sin(cameraAngle.current);
      const cosA = Math.cos(cameraAngle.current);
      const forward = dx * sinA - dy * cosA;
      const right = dx * cosA + dy * sinA;
      if (forward > 20) {
        const scale = 550 / forward;
        fx = W * 0.5 + right * scale;
        fy = H * 0.5 + cameraPitch.current;
      }
    } else {
      fx = imp.x - cameraX;
      fy = imp.y - cameraY;
    }

    fx = Math.max(-40, Math.min(W + 40, fx));
    fy = Math.max(-40, Math.min(H + 40, fy));

    const maxRad = Math.hypot(Math.max(fx, W - fx), Math.max(fy, H - fy)) * 1.15;
    const pseudoRand = (n: number) => {
      const v = Math.sin((imp.seed + n * 12.9898) * 78.233) * 43758.5453;
      return v - Math.floor(v);
    };

    ctx.save();

    if (prog < 0.28) {
      // Beat 1: Pitch-Black Ink Cut + Blinding White Starburst Wedges
      ctx.fillStyle = 'rgba(2, 6, 23, 0.92)';
      ctx.fillRect(0, 0, W, H);

      const rayCount = 30;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < rayCount; i++) {
        const baseA = (i / rayCount) * Math.PI * 2 + pseudoRand(i) * 0.14;
        const spread = 0.02 + pseudoRand(i + 50) * 0.055;
        const innerR = 14 + pseudoRand(i + 90) * 28;
        const outerR = maxRad * (0.65 + pseudoRand(i + 140) * 0.4);
        ctx.beginPath();
        ctx.moveTo(fx + Math.cos(baseA) * innerR, fy + Math.sin(baseA) * innerR);
        ctx.lineTo(fx + Math.cos(baseA - spread) * outerR, fy + Math.sin(baseA - spread) * outerR);
        ctx.lineTo(fx + Math.cos(baseA + spread) * outerR, fy + Math.sin(baseA + spread) * outerR);
        ctx.closePath();
        ctx.fill();
      }

      // Crisp cross-slash & hollow core ring
      const slashAng = pseudoRand(301) * Math.PI;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(fx - Math.cos(slashAng) * maxRad, fy - Math.sin(slashAng) * maxRad);
      ctx.lineTo(fx + Math.cos(slashAng) * maxRad, fy + Math.sin(slashAng) * maxRad);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(fx, fy, 42 + prog * 80, 0, Math.PI * 2);
      ctx.fill();
    } else if (prog < 0.56) {
      // Beat 2: Inverted Whiteout + Pitch-Black Jagged Ink Spikes & Accent Slash
      ctx.fillStyle = 'rgba(255, 255, 255, 0.93)';
      ctx.fillRect(0, 0, W, H);

      const spikeCount = 34;
      ctx.fillStyle = '#020617';
      for (let i = 0; i < spikeCount; i++) {
        const baseA = (i / spikeCount) * Math.PI * 2 + pseudoRand(i + 200) * 0.12;
        const spread = 0.025 + pseudoRand(i + 240) * 0.06;
        const innerR = 18 + pseudoRand(i + 280) * 38;
        const outerR = maxRad * (0.72 + pseudoRand(i + 320) * 0.35);
        ctx.beginPath();
        ctx.moveTo(fx + Math.cos(baseA) * innerR, fy + Math.sin(baseA) * innerR);
        ctx.lineTo(fx + Math.cos(baseA - spread) * outerR, fy + Math.sin(baseA - spread) * outerR);
        ctx.lineTo(fx + Math.cos(baseA + spread) * outerR, fy + Math.sin(baseA + spread) * outerR);
        ctx.closePath();
        ctx.fill();
      }

      // Jagged black lightning fractures
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 4.5;
      for (let b = 0; b < 6; b++) {
        let bx = fx;
        let by = fy;
        const dirA = (b / 6) * Math.PI * 2 + pseudoRand(b + 400) * 0.6;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        for (let seg = 1; seg <= 5; seg++) {
          const step = (maxRad * 0.16) * (0.8 + pseudoRand(b * 10 + seg) * 0.5);
          const jitterA = dirA + (pseudoRand(b * 20 + seg) - 0.5) * 0.55;
          bx += Math.cos(jitterA) * step;
          by += Math.sin(jitterA) * step;
          ctx.lineTo(bx, by);
        }
        ctx.stroke();
      }

      // Vivid accent slash cutting through the whiteout
      const slashAng = pseudoRand(301) * Math.PI;
      ctx.strokeStyle = imp.accent;
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(fx - Math.cos(slashAng) * maxRad, fy - Math.sin(slashAng) * maxRad);
      ctx.lineTo(fx + Math.cos(slashAng) * maxRad, fy + Math.sin(slashAng) * maxRad);
      ctx.stroke();

      ctx.fillStyle = '#020617';
      ctx.beginPath();
      ctx.arc(fx, fy, 34, 0, Math.PI * 2);
      ctx.fill();
    } else if (prog < 0.78) {
      // Beat 3: High-Contrast Charcoal Strobe + Colored Radial Flash
      ctx.fillStyle = 'rgba(2, 6, 23, 0.62)';
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = imp.accent;
      ctx.lineWidth = 6;
      const ringR = 55 + (prog - 0.56) * 950;
      ctx.beginPath();
      ctx.arc(fx, fy, ringR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      const streakCount = 22;
      for (let i = 0; i < streakCount; i++) {
        const a = (i / streakCount) * Math.PI * 2 + pseudoRand(i + 500) * 0.15;
        const r1 = ringR * 0.65;
        const r2 = maxRad * 0.98;
        ctx.beginPath();
        ctx.moveTo(fx + Math.cos(a) * r1, fy + Math.sin(a) * r1);
        ctx.lineTo(fx + Math.cos(a) * r2, fy + Math.sin(a) * r2);
        ctx.stroke();
      }
    } else {
      // Beat 4: Chromatic Aberration Aftershock Rings
      const fade = Math.max(0, 1 - (prog - 0.78) / 0.22);
      const baseR = 140 + (prog - 0.78) * 1400;
      ctx.globalAlpha = fade * 0.85;

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 6 * fade + 1;
      ctx.beginPath();
      ctx.arc(fx - 9, fy - 4, baseR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 6 * fade + 1;
      ctx.beginPath();
      ctx.arc(fx + 9, fy + 4, baseR * 0.94, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = imp.accent;
      ctx.lineWidth = 4 * fade + 1;
      ctx.beginPath();
      ctx.arc(fx, fy, baseR * 1.06, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    // Calculate camera position
    const { width: CANVAS_WIDTH, height: CANVAS_HEIGHT } = dimensionsRef.current;
    if (entranceCutscene.current.active) {
      drawEntranceCutscene(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      drawImpactFrameOverlay(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      return;
    }
    if (phase2Cutscene.current.active) {
      drawPhase2Cutscene(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      drawImpactFrameOverlay(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      return;
    }
    if (phase3Cutscene.current.active) {
      drawPhase3Cutscene(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      drawImpactFrameOverlay(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      return;
    }
    if (deathCutscene.current.active) {
      drawDeathCutscene(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      return;
    }
    const cameraX = Math.max(0, Math.min(WORLD_WIDTH - CANVAS_WIDTH, player.current.x - CANVAS_WIDTH / 2));
    const cameraY = Math.max(0, Math.min(WORLD_HEIGHT - CANVAS_HEIGHT, player.current.y - CANVAS_HEIGHT / 2));
    
    if (modifiers.mode3D) {
      // --- TRUE 1ST-PERSON 3D RENDER PIPELINE ---
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const camX = player.current.x;
      const camY = player.current.y;
      const camZ = 50; // 1st person eye level
      const camAngle = cameraAngle.current;
      const camPitch = cameraPitch.current;
      const focalLength = 550;
      const horizonY = CANVAS_HEIGHT * 0.5 + camPitch; // Centered horizon at eye level + pitch look

      let shakeOffX = 0;
      let shakeOffY = 0;
      if (screenShake.current > 0) {
        shakeOffX = (Math.random() - 0.5) * screenShake.current;
        shakeOffY = (Math.random() - 0.5) * screenShake.current;
      }

      // Sky Gradient - Brighter, luminous battle horizon
      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
      if (isOnMoon.current) {
        skyGrad.addColorStop(0, '#0f172a');
        skyGrad.addColorStop(1, '#334155');
      } else if (boss.current.state === 'SMASH_2') {
        skyGrad.addColorStop(0, '#7f1d1d');
        skyGrad.addColorStop(1, '#ea580c');
      } else {
        skyGrad.addColorStop(0, '#0f172a');
        skyGrad.addColorStop(0.45, '#1e3a8a');
        skyGrad.addColorStop(0.85, '#2563eb');
        skyGrad.addColorStop(1, '#60a5fa');
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, horizonY);

      // Starfield in sky
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      for (let s = 0; s < 50; s++) {
        const sx = (s * 137.5 + performance.now() * 0.005) % CANVAS_WIDTH;
        const sy = (s * 53) % (horizonY - 5);
        ctx.fillRect(sx, sy, (s % 3) + 1.2, (s % 3) + 1.2);
      }
      ctx.restore();

      // Horizon line glow - bright radiant cyan/blue neon edge
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, horizonY + shakeOffY);
      ctx.lineTo(CANVAS_WIDTH, horizonY + shakeOffY);
      ctx.stroke();

      // Floor Gradient - Brighter illuminated arena
      const floorGrad = ctx.createLinearGradient(0, horizonY, 0, CANVAS_HEIGHT);
      if (isOnMoon.current) {
        floorGrad.addColorStop(0, '#334155');
        floorGrad.addColorStop(1, '#475569');
      } else if (boss.current.state === 'SMASH_2') {
        floorGrad.addColorStop(0, '#9a3412');
        floorGrad.addColorStop(1, '#c2410c');
      } else {
        floorGrad.addColorStop(0, '#1e293b');
        floorGrad.addColorStop(1, '#334155');
      }
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, horizonY, CANVAS_WIDTH, CANVAS_HEIGHT - horizonY);

      // 3D Point Projection Helper
      const project3D = (wx: number, wy: number, wz: number = 0) => {
        const relX = wx - camX;
        const relY = wy - camY;

        const dz = relX * Math.sin(camAngle) - relY * Math.cos(camAngle);
        const rotX = relX * Math.cos(camAngle) + relY * Math.sin(camAngle);

        if (dz <= 10) return null;

        const scale = focalLength / dz;
        const screenX = CANVAS_WIDTH / 2 + rotX * scale + shakeOffX;
        const screenY = horizonY + (camZ - wz) * scale + shakeOffY;
        return { screenX, screenY, scale, dz, rotX };
      };

      // 3D Floor Grid Segment Renderer with frustum clipping
      ctx.save();
      ctx.strokeStyle = isOnMoon.current ? 'rgba(226, 232, 240, 0.6)' : 'rgba(147, 197, 253, 0.65)';
      ctx.lineWidth = 2;

      const drawGridSegment = (wx1: number, wy1: number, wx2: number, wy2: number) => {
        const relX1 = wx1 - camX, relY1 = wy1 - camY;
        const relX2 = wx2 - camX, relY2 = wy2 - camY;

        let dz1 = relX1 * Math.sin(camAngle) - relY1 * Math.cos(camAngle);
        let rotX1 = relX1 * Math.cos(camAngle) + relY1 * Math.sin(camAngle);

        let dz2 = relX2 * Math.sin(camAngle) - relY2 * Math.cos(camAngle);
        let rotX2 = relX2 * Math.cos(camAngle) + relY2 * Math.sin(camAngle);

        if (dz1 < 10 && dz2 < 10) return;

        if (dz1 < 10) {
          const t = (10 - dz1) / (dz2 - dz1);
          rotX1 = rotX1 + t * (rotX2 - rotX1);
          dz1 = 10;
        } else if (dz2 < 10) {
          const t = (10 - dz2) / (dz1 - dz2);
          rotX2 = rotX2 + t * (rotX1 - rotX2);
          dz2 = 10;
        }

        const scale1 = focalLength / dz1;
        const sx1 = CANVAS_WIDTH / 2 + rotX1 * scale1 + shakeOffX;
        const sy1 = horizonY + camZ * scale1 + shakeOffY;

        const scale2 = focalLength / dz2;
        const sx2 = CANVAS_WIDTH / 2 + rotX2 * scale2 + shakeOffX;
        const sy2 = horizonY + camZ * scale2 + shakeOffY;

        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();
      };

      for (let gx = 0; gx <= WORLD_WIDTH; gx += 200) {
        drawGridSegment(gx, 0, gx, WORLD_HEIGHT);
      }
      for (let gy = 0; gy <= WORLD_HEIGHT; gy += 200) {
        drawGridSegment(0, gy, WORLD_WIDTH, gy);
      }

      // 3D Coliseum Arena Center Octagon & Cardinal Runways
      ctx.strokeStyle =
        boss.current.phase >= 3
          ? 'rgba(192, 132, 252, 0.8)'
          : boss.current.phase === 2
          ? 'rgba(248, 113, 113, 0.75)'
          : 'rgba(251, 191, 36, 0.7)';
      ctx.lineWidth = 3;
      const arenaR = 680;
      for (let i = 0; i < 8; i++) {
        const a1 = (i / 8) * Math.PI * 2;
        const a2 = ((i + 1) / 8) * Math.PI * 2;
        drawGridSegment(
          WORLD_WIDTH / 2 + Math.cos(a1) * arenaR,
          WORLD_HEIGHT / 2 + Math.sin(a1) * arenaR,
          WORLD_WIDTH / 2 + Math.cos(a2) * arenaR,
          WORLD_HEIGHT / 2 + Math.sin(a2) * arenaR
        );
      }
      drawGridSegment(WORLD_WIDTH / 2, 0, WORLD_WIDTH / 2, WORLD_HEIGHT);
      drawGridSegment(0, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT / 2);
      ctx.restore();

      // Red Boundary Fence
      ctx.save();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      drawGridSegment(0, 0, WORLD_WIDTH, 0);
      drawGridSegment(WORLD_WIDTH, 0, WORLD_WIDTH, WORLD_HEIGHT);
      drawGridSegment(WORLD_WIDTH, WORLD_HEIGHT, 0, WORLD_HEIGHT);
      drawGridSegment(0, WORLD_HEIGHT, 0, 0);
      ctx.restore();

      type Billboard = {
        dz: number;
        render: () => void;
      };
      const billboards: Billboard[] = [];

      // 3D Arena Corner Energy Pylons & Quadrant Beacons
      const pylons = [
        { x: 120, y: 120, color: '#ef4444', h: 280 },
        { x: WORLD_WIDTH - 120, y: 120, color: '#ef4444', h: 280 },
        { x: 120, y: WORLD_HEIGHT - 120, color: '#ef4444', h: 280 },
        { x: WORLD_WIDTH - 120, y: WORLD_HEIGHT - 120, color: '#ef4444', h: 280 },
        { x: 1000, y: 1000, color: '#f59e0b', h: 190 },
        { x: 3000, y: 1000, color: '#06b6d4', h: 190 },
        { x: 1000, y: 3000, color: '#22c55e', h: 190 },
        { x: 3000, y: 3000, color: '#f43f5e', h: 190 },
      ];
      pylons.forEach(pyl => {
        const relX = pyl.x - camX, relY = pyl.y - camY;
        const dz = relX * Math.sin(camAngle) - relY * Math.cos(camAngle);
        if (dz > 10) {
          billboards.push({
            dz,
            render: () => {
              const base = project3D(pyl.x, pyl.y, 0);
              const top = project3D(pyl.x, pyl.y, pyl.h);
              if (!base || !top) return;
              ctx.save();
              const wP = Math.max(4, 24 * base.scale);
              const grad = ctx.createLinearGradient(top.screenX, top.screenY, base.screenX, base.screenY);
              grad.addColorStop(0, pyl.color);
              grad.addColorStop(1, '#0f172a');
              ctx.fillStyle = grad;
              ctx.fillRect(top.screenX - wP / 2, top.screenY, wP, Math.max(2, base.screenY - top.screenY));
              ctx.fillStyle = '#ffffff';
              ctx.shadowColor = pyl.color;
              ctx.shadowBlur = 18;
              ctx.beginPath();
              ctx.arc(top.screenX, top.screenY, Math.max(3, 14 * top.scale), 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
          });
        }
      });

      // Black Hole
      if (modifiers.blackHoleCore) {
        const bhX = WORLD_WIDTH / 2;
        const bhY = WORLD_HEIGHT / 2;
        const relX = bhX - camX, relY = bhY - camY;
        const dz = relX * Math.sin(camAngle) - relY * Math.cos(camAngle);
        billboards.push({
          dz,
          render: () => {
            const p = project3D(bhX, bhY, 0);
            if (!p) return;
            ctx.save();
            ctx.translate(p.screenX, p.screenY);
            ctx.scale(p.scale, p.scale);
            ctx.rotate(performance.now() / 1000);
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 300);
            gradient.addColorStop(0, '#000000');
            gradient.addColorStop(0.3, '#000000');
            gradient.addColorStop(0.5, '#4c1d95');
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, 300, 0, Math.PI * 2);
            ctx.fill();
            if (blackHoleImage.complete) {
              ctx.globalAlpha = 0.6;
              ctx.drawImage(blackHoleImage, -150, -150, 300, 300);
            }
            ctx.restore();
          }
        });
      }

      // Dimension Tears
      if (modifiers.dimensionTear) {
        dimensionTears.current.forEach(tear => {
          const relX = tear.x - camX, relY = tear.y - camY;
          const dz = relX * Math.sin(camAngle) - relY * Math.cos(camAngle);
          billboards.push({
            dz,
            render: () => {
              const p = project3D(tear.x, tear.y, 0);
              if (!p) return;
              ctx.save();
              ctx.translate(p.screenX, p.screenY);
              ctx.scale(p.scale, p.scale);
              ctx.rotate(performance.now() / 500);
              if (dimensionTearImage.complete) {
                ctx.drawImage(dimensionTearImage, -tear.radius / 2, -tear.radius / 2, tear.radius, tear.radius);
              } else {
                ctx.strokeStyle = '#8b5cf6';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(0, 0, tear.radius / 2, 0, Math.PI * 2);
                ctx.stroke();
              }
              ctx.restore();
            }
          });
        });
      }

      // Walls (3D Armored Bunkers)
      if (modifiers.enhancedMap) {
        walls.current.forEach(w => {
          const wallY = w.y + w.height / 2;
          const relX = (w.x + w.width / 2) - camX, relY = wallY - camY;
          const dz = relX * Math.sin(camAngle) - relY * Math.cos(camAngle);
          billboards.push({
            dz,
            render: () => {
              const p = project3D(w.x + w.width / 2, wallY, 0);
              if (!p) return;
              const wScaled = w.width * p.scale;
              const hScaled = w.height * p.scale;
              const x0 = p.screenX - wScaled / 2;
              const y0 = p.screenY - hScaled / 2;
              ctx.save();
              const wallGrad = ctx.createLinearGradient(x0, y0, x0, y0 + hScaled);
              wallGrad.addColorStop(0, '#475569');
              wallGrad.addColorStop(1, '#1e293b');
              ctx.fillStyle = wallGrad;
              ctx.fillRect(x0, y0, wScaled, hScaled);
              ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
              ctx.fillRect(x0, y0, wScaled, Math.max(2, hScaled * 0.14));
              ctx.strokeStyle = '#38bdf8';
              ctx.lineWidth = Math.max(1, 2 * p.scale);
              ctx.strokeRect(x0, y0, wScaled, hScaled);
              ctx.restore();
            }
          });
        });
      }

      // Boss
      const bRelX = boss.current.x - camX, bRelY = boss.current.y - camY;
      const bDz = bRelX * Math.sin(camAngle) - bRelY * Math.cos(camAngle);
      billboards.push({
        dz: bDz,
        render: () => {
          const p = project3D(boss.current.x, boss.current.y, 0);
          if (!p) return;
          ctx.save();
          ctx.translate(p.screenX, p.screenY);
          ctx.scale(p.scale, p.scale);
          drawBossVisuals(ctx);
          ctx.restore();
        }
      });

      // Orbiting / Targeting / Thrown Big Macs 3D Billboards
      orbitingBurgers.current.forEach(b => {
        const bRelX = b.x - camX, bRelY = b.y - camY;
        const bDz = bRelX * Math.sin(camAngle) - bRelY * Math.cos(camAngle);
        if (bDz > 10) {
          billboards.push({
            dz: bDz,
            render: () => {
              const p = project3D(b.x, b.y, 25);
              if (!p) return;
              ctx.save();
              ctx.translate(p.screenX, p.screenY);
              ctx.scale(p.scale, p.scale);
              if (b.state === 'TARGETING') {
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(0, 0, b.width * 0.72, 0, Math.PI * 2);
                ctx.stroke();
              }
              ctx.rotate(b.rotation);
              ctx.shadowColor = b.state === 'TARGETING' ? '#ef4444' : '#f59e0b';
              ctx.shadowBlur = 22;
              if (bigMacImage.complete && bigMacImage.naturalWidth > 0) {
                ctx.drawImage(bigMacImage, -b.width / 2, -b.height / 2, b.width, b.height);
              } else {
                ctx.font = `${b.width}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🍔', 0, 0);
              }
              ctx.restore();
            }
          });
        }
      });

      // Helicopter
      if (helicopter.current.active) {
        const h = helicopter.current;
        const hRelX = h.x - camX, hRelY = h.y - camY;
        const hDz = hRelX * Math.sin(camAngle) - hRelY * Math.cos(camAngle);
        billboards.push({
          dz: hDz,
          render: () => {
            const p = project3D(h.x, h.y, 140);
            if (!p) return;
            ctx.save();
            ctx.translate(p.screenX, p.screenY);
            ctx.scale(p.scale, p.scale);
            const rot = h.rotation || (Math.sin(performance.now() / 200) * 0.05);
            ctx.rotate(rot);

            if (helicopterImage.complete) {
              ctx.drawImage(helicopterImage, -h.width / 2, -h.height / 2, h.width, h.height);
            }
            if (cartmanImage.complete) {
              ctx.drawImage(cartmanImage, -35, -22, 65, 65);
            }

            // Fire & grease smoke when crashing from cholesterol beam
            if (h.phase === 'CRASHING') {
              ctx.save();
              ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
              ctx.shadowColor = '#f59e0b';
              ctx.shadowBlur = 25;
              ctx.beginPath();
              ctx.arc(-h.width * 0.25, 0, 32 + Math.sin(performance.now() / 30) * 10, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            const rotorAngle = (performance.now() / 15) % (Math.PI * 2);
            ctx.ellipse(0, -h.height / 2 + 5, h.width * 0.7, 10, rotorAngle, 0, Math.PI * 2);
            ctx.stroke();

            const ladderLen = h.ladderLength || 0;
            if (ladderLen > 10) {
              ctx.strokeStyle = '#78350f';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.moveTo(-16, 25);
              ctx.lineTo(-16, 25 + ladderLen);
              ctx.moveTo(16, 25);
              ctx.lineTo(16, 25 + ladderLen);
              ctx.stroke();
            }
            ctx.restore();
          }
        });
      }

      // Projectiles
      projectiles.current.forEach(proj => {
        const pRelX = proj.x - camX, pRelY = proj.y - camY;
        const pDz = pRelX * Math.sin(camAngle) - pRelY * Math.cos(camAngle);
        billboards.push({
          dz: pDz,
          render: () => {
            const p = project3D(proj.x, proj.y, proj.isPlayer ? 15 : 20);
            if (!p) return;
            ctx.save();
            ctx.translate(p.screenX, p.screenY);
            ctx.scale(p.scale, p.scale);
            if (proj.isSummonGuy && proj.life !== undefined) {
              ctx.strokeStyle = '#38bdf8';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.arc(0, 0, proj.radius * (1.2 + (proj.life / 2.2) * 0.8), 0, Math.PI * 2);
              ctx.stroke();
            } else if (proj.isOatmeal && proj.vx === 0 && proj.life !== undefined) {
              ctx.strokeStyle = '#ef4444';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.arc(0, 0, proj.radius * 1.4, -Math.PI / 2, -Math.PI / 2 + (1 - Math.max(0, proj.life / 1.5)) * Math.PI * 2);
              ctx.stroke();
            }
            ctx.rotate(proj.rotation);

            if (proj.isPlayer && !proj.isHealthy) {
              ctx.shadowColor = '#38bdf8';
              ctx.shadowBlur = 18;
              ctx.fillStyle = '#38bdf8';
              ctx.beginPath();
              ctx.ellipse(0, 0, proj.radius * 2.1, proj.radius * 0.55, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.ellipse(0, 0, proj.radius * 1.3, proj.radius * 0.25, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
              return;
            }

            if (proj.isPlayer || proj.isHealthy) {
              ctx.shadowColor = '#4ade80';
              ctx.shadowBlur = 18;
            } else {
              ctx.shadowColor = '#f87171';
              ctx.shadowBlur = 12;
            }

            let projImg = junkFoodImage;
            if (proj.isDongfish) projImg = dongfishImage;
            else if (proj.isSummonGuy) projImg = summonGuyImage;
            else if (proj.isChef) projImg = chefImage;
            else if (proj.isOatmeal) projImg = oatmealImage;
            else if (proj.isBigMac) projImg = bigMacImage;
            else if (proj.isCherryCoke) projImg = cherryCokeImage;
            else if (proj.isCreamPepsi) projImg = creamPepsiImage;
            else if (proj.isHealthy) projImg = healthyFoodImage;

            const useEmojiOnly =
              !!proj.isMinigun &&
              !proj.isHealthy &&
              !proj.isDongfish &&
              !proj.isOreo &&
              !proj.isChef &&
              !proj.isOatmeal &&
              !proj.isBigMac &&
              !proj.isCherryCoke &&
              !proj.isCreamPepsi &&
              proj.emoji !== '🍗';

            const isMonkBullet = !!proj.isMonkBullet;
            if (proj.isWhitePellet) {
              ctx.fillStyle = '#ffffff';
              ctx.shadowColor = '#38bdf8';
              ctx.shadowBlur = 22;
              ctx.beginPath();
              ctx.arc(0, 0, proj.radius, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#e0f2fe';
              ctx.beginPath();
              ctx.arc(0, 0, proj.radius * 0.5, 0, Math.PI * 2);
              ctx.fill();
            } else if (!proj.isBandAid && !isMonkBullet && !useEmojiOnly && projImg.complete && projImg.naturalWidth > 0) {
              ctx.beginPath();
              ctx.arc(0, 0, proj.radius, 0, Math.PI * 2);
              ctx.clip();
              ctx.drawImage(projImg, -proj.radius * 1.2, -proj.radius * 1.2, proj.radius * 2.4, proj.radius * 2.4);
            } else if (isMonkBullet) {
              ctx.fillStyle = '#fcd34d';
              ctx.beginPath();
              ctx.ellipse(0, 0, proj.radius * 2.2, proj.radius * 0.5, 0, 0, Math.PI * 2);
              ctx.fill();
            } else {
              ctx.font = `${proj.radius * 2}px Arial`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(proj.emoji, 0, 0);
            }
            ctx.restore();
          }
        });
      });

      // Particles
      particles.current.forEach(part => {
        const partRelX = part.x - camX, partRelY = part.y - camY;
        const partDz = partRelX * Math.sin(camAngle) - partRelY * Math.cos(camAngle);
        billboards.push({
          dz: partDz,
          render: () => {
            const p = project3D(part.x, part.y, 5);
            if (!p) return;
            ctx.save();
            ctx.globalAlpha = part.life / part.maxLife;
            ctx.fillStyle = part.color;
            ctx.beginPath();
            ctx.arc(p.screenX, p.screenY, part.size * p.scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        });
      });

      // 3D Shockwaves
      shockwaves.current.forEach(sw => {
        const swRelX = sw.x - camX, swRelY = sw.y - camY;
        const swDz = swRelX * Math.sin(camAngle) - swRelY * Math.cos(camAngle);
        if (swDz > 10) {
          billboards.push({
            dz: swDz,
            render: () => {
              const p = project3D(sw.x, sw.y, 0);
              if (!p) return;
              const progress = sw.radius / sw.maxRadius;
              const rX = sw.radius * p.scale;
              const rY = rX * 0.35; // projected flat on 3D ground
              ctx.save();
              ctx.globalAlpha = Math.max(0, 1 - progress);
              ctx.strokeStyle = sw.color;
              ctx.lineWidth = Math.max(1, sw.width * p.scale);
              ctx.shadowColor = sw.color;
              ctx.shadowBlur = 15;
              ctx.beginPath();
              ctx.ellipse(p.screenX, p.screenY, rX, rY, 0, 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();
            }
          });
        }
      });

      // 3D Floating Combat Text Billboards
      floatingTexts.current.forEach(ft => {
        const fRelX = ft.x - camX, fRelY = ft.y - camY;
        const fDz = fRelX * Math.sin(camAngle) - fRelY * Math.cos(camAngle);
        if (fDz > 10) {
          billboards.push({
            dz: fDz,
            render: () => {
              const p = project3D(ft.x, ft.y, 50);
              if (!p) return;
              ctx.save();
              ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
              ctx.font = `900 ${Math.max(12, Math.round(ft.size * Math.min(1.4, p.scale)))}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.strokeStyle = '#020617';
              ctx.lineWidth = 4;
              ctx.strokeText(ft.text, p.screenX, p.screenY);
              ctx.fillStyle = ft.color;
              ctx.fillText(ft.text, p.screenX, p.screenY);
              ctx.restore();
            }
          });
        }
      });

      // Sort billboards by distance (farthest first)
      billboards.sort((a, b) => b.dz - a.dz);
      billboards.forEach(b => b.render());

      // 3D Cholesterol & Calorie Hyper-Beam
      if (helicopter.current.active && helicopter.current.isAmbushed && 
         (helicopter.current.phase === 'CRASHING' || (helicopter.current.phase === 'ESCAPE' && (helicopter.current.cutsceneTimer || 0) >= 0.5))) {
        const h = helicopter.current;
        const pB = project3D(boss.current.x, boss.current.y, 40);
        const pH = project3D(h.x, h.y, 140);
        if (pB && pH) {
          ctx.save();
          // Outer blazing cholesterol sheath
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
          ctx.lineWidth = 36 * ((pB.scale + pH.scale) / 2);
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 25;
          ctx.beginPath();
          ctx.moveTo(pB.screenX, pB.screenY);
          ctx.lineTo(pH.screenX, pH.screenY);
          ctx.stroke();

          // Inner sizzling fat core
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 14 * ((pB.scale + pH.scale) / 2);
          ctx.shadowColor = '#fbbf24';
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.moveTo(pB.screenX, pB.screenY);
          ctx.lineTo(pH.screenX, pH.screenY);
          ctx.stroke();

          // Caloric explosion flash on helicopter
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(pH.screenX, pH.screenY, 35 * pH.scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // 1st Person Crosshair
      ctx.save();
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.85)';
      ctx.lineWidth = 2;
      const cx = CANVAS_WIDTH / 2;
      const cy = CANVAS_HEIGHT / 2;
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy); ctx.lineTo(cx - 4, cy);
      ctx.moveTo(cx + 4, cy);  ctx.lineTo(cx + 12, cy);
      ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy - 4);
      ctx.moveTo(cx, cy + 4);  ctx.lineTo(cx, cy + 12);
      ctx.stroke();

      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 1st Person Compass Overlay Banner
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(CANVAS_WIDTH / 2 - 210, 10, 420, 28);
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(CANVAS_WIDTH / 2 - 210, 10, 420, 28);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      const deg = Math.floor((((camAngle * 180 / Math.PI) % 360) + 360) % 360);
      const lockText = isPointerLocked ? '🔒 MOUSE LOCKED (ESC TO RELEASE)' : '🖱️ CLICK SCREEN TO LOCK MOUSE';
      ctx.fillText(`👀 1ST PERSON 3D | HEADING: ${deg}° | ${lockText}`, CANVAS_WIDTH / 2, 28);
      ctx.restore();
    } else {
      // 2D MODE WORLD RENDER
      // Clear background with bright, crisp slate base
      ctx.fillStyle = '#1e293b'; // slate-800
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.save();
    // Apply camera zoom
    if (modifiers.bigMode) {
      ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.scale(cameraZoom.current, cameraZoom.current);
      ctx.translate(-CANVAS_WIDTH / 2, -CANVAS_HEIGHT / 2);
    }

    if (screenShake.current > 0) {
      const shakeX = (Math.random() - 0.5) * screenShake.current;
      const shakeY = (Math.random() - 0.5) * screenShake.current;
      ctx.translate(shakeX, shakeY);
    }
    ctx.translate(-cameraX, -cameraY);

    if (isOnMoon.current) {
      if (moonImage.complete) {
        ctx.drawImage(moonImage, 0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      } else {
        ctx.fillStyle = '#334155';
        ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      }
    } else if (boss.current.state === 'SMASH_2') {
      ctx.fillStyle = '#7c2d12';
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    } else {
      const floorGrad = ctx.createRadialGradient(
        WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 200,
        WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH * 0.72
      );
      floorGrad.addColorStop(0, boss.current.phase >= 3 ? '#240f3b' : boss.current.phase === 2 ? '#291728' : '#1e293b');
      floorGrad.addColorStop(0.6, '#172033');
      floorGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    }

    // Subtle alternating arena floor tiles (320x320) for clear movement speed perception
    const startTileX = Math.max(0, Math.floor(cameraX / 320) * 320);
    const endTileX = Math.min(WORLD_WIDTH, cameraX + CANVAS_WIDTH + 320);
    const startTileY = Math.max(0, Math.floor(cameraY / 320) * 320);
    const endTileY = Math.min(WORLD_HEIGHT, cameraY + CANVAS_HEIGHT + 320);
    for (let tx = startTileX; tx < endTileX; tx += 320) {
      for (let ty = startTileY; ty < endTileY; ty += 320) {
        if (((tx / 320) + (ty / 320)) % 2 === 0) {
          ctx.fillStyle = isOnMoon.current ? 'rgba(255,255,255,0.03)' : 'rgba(56, 189, 248, 0.03)';
          ctx.fillRect(tx, ty, 320, 320);
        }
      }
    }

    // Arena Grid (80px sub-grid + 320px major sector lines)
    ctx.strokeStyle = isOnMoon.current ? 'rgba(148, 163, 184, 0.22)' : 'rgba(71, 85, 105, 0.45)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= WORLD_WIDTH; i += 80) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, WORLD_HEIGHT);
      ctx.stroke();
    }
    for (let i = 0; i <= WORLD_HEIGHT; i += 80) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(WORLD_WIDTH, i);
      ctx.stroke();
    }
    ctx.strokeStyle = isOnMoon.current ? 'rgba(226, 232, 240, 0.25)' : 'rgba(56, 189, 248, 0.14)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i <= WORLD_WIDTH; i += 320) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, WORLD_HEIGHT);
      ctx.stroke();
    }
    for (let i = 0; i <= WORLD_HEIGHT; i += 320) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(WORLD_WIDTH, i);
      ctx.stroke();
    }

    // Coliseum Cardinal Runways & Central Arena Emblem
    const arenaNow = performance.now();
    const sealColor = isOnMoon.current ? '#cbd5e1' : (boss.current.phase >= 3 ? '#c084fc' : boss.current.phase === 2 ? '#ef4444' : '#38bdf8');
    ctx.save();
    ctx.strokeStyle =
      boss.current.phase >= 3
        ? 'rgba(192, 132, 252, 0.25)'
        : boss.current.phase === 2
        ? 'rgba(239, 68, 68, 0.22)'
        : 'rgba(56, 189, 248, 0.18)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(WORLD_WIDTH / 2, 140);
    ctx.lineTo(WORLD_WIDTH / 2, WORLD_HEIGHT - 140);
    ctx.moveTo(140, WORLD_HEIGHT / 2);
    ctx.lineTo(WORLD_WIDTH - 140, WORLD_HEIGHT / 2);
    ctx.stroke();

    ctx.translate(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    ctx.strokeStyle = sealColor;
    ctx.globalAlpha = 0.24;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, 560, 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.rotate(arenaNow / 14000);
    ctx.setLineDash([36, 18]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 440, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.rotate(-arenaNow / 10000);
    ctx.beginPath();
    for (let oct = 0; oct < 8; oct++) {
      const a = (oct / 8) * Math.PI * 2;
      const ox = Math.cos(a) * 320;
      const oy = Math.sin(a) * 320;
      if (oct === 0) ctx.moveTo(ox, oy);
      else ctx.lineTo(ox, oy);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    ctx.restore();

    // 4 Named Arena Quadrant Landmarks (spatial orientation across 4000x4000 map)
    const quadrants = [
      { x: 1000, y: 1000, label: 'FRYER FOUNDRY', color: '#f59e0b', icon: '🍟' },
      { x: 3000, y: 1000, label: 'CALORIE REACTOR', color: '#06b6d4', icon: '⚡' },
      { x: 1000, y: 3000, label: 'SALAD SANCTUARY', color: '#22c55e', icon: '🥗' },
      { x: 3000, y: 3000, label: 'ROTISSERIE CRUCIBLE', color: '#f43f5e', icon: '🍗' },
    ];
    quadrants.forEach((q, qi) => {
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.globalAlpha = 0.26;
      ctx.strokeStyle = q.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 210, 0, Math.PI * 2);
      ctx.stroke();
      ctx.save();
      ctx.rotate((arenaNow / 6000) * (qi % 2 === 0 ? 1 : -1));
      ctx.setLineDash([18, 12]);
      ctx.beginPath();
      ctx.arc(0, 0, 155, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = q.color;
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(q.icon, 0, -14);
      ctx.font = '900 13px sans-serif';
      ctx.fillText(q.label, 0, 20);
      ctx.restore();
    });

    // Stadium center light glow in 2D
    const centerGrad = ctx.createRadialGradient(
      WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 100,
      WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH * 0.7
    );
    centerGrad.addColorStop(
      0,
      boss.current.phase >= 3
        ? 'rgba(168, 85, 247, 0.2)'
        : boss.current.phase === 2
        ? 'rgba(239, 68, 68, 0.16)'
        : 'rgba(56, 189, 248, 0.14)'
    );
    centerGrad.addColorStop(0.5, 'rgba(99, 102, 241, 0.06)');
    centerGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = centerGrad;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Draw Persistent Battle Scars (Ground Craters, Magma Fissures, Scorches)
    groundMarks.current.forEach(gm => {
      const alpha = Math.max(0, gm.life / gm.maxLife);
      ctx.save();
      ctx.translate(gm.x, gm.y);
      ctx.rotate(gm.angle);
      ctx.globalAlpha = alpha * 0.75;
      if (gm.type === 'CRATER') {
        const cGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, gm.radius);
        cGrad.addColorStop(0, 'rgba(15, 23, 42, 0.9)');
        cGrad.addColorStop(0.65, 'rgba(124, 45, 18, 0.5)');
        cGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = cGrad;
        ctx.beginPath();
        ctx.arc(0, 0, gm.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = gm.color;
        ctx.lineWidth = 2.5;
        for (let cr = 0; cr < 7; cr++) {
          const ca = (cr / 7) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ca) * 14, Math.sin(ca) * 14);
          ctx.lineTo(Math.cos(ca + 0.15) * (gm.radius * 0.55), Math.sin(ca + 0.15) * (gm.radius * 0.55));
          ctx.lineTo(Math.cos(ca - 0.1) * (gm.radius * 0.92), Math.sin(ca - 0.1) * (gm.radius * 0.92));
          ctx.stroke();
        }
      } else if (gm.type === 'FISSURE') {
        ctx.strokeStyle = gm.color;
        ctx.shadowColor = gm.color;
        ctx.shadowBlur = 14;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-gm.radius, 0);
        ctx.lineTo(-gm.radius * 0.45, -14);
        ctx.lineTo(0, 10);
        ctx.lineTo(gm.radius * 0.48, -12);
        ctx.lineTo(gm.radius, 4);
        ctx.stroke();
      } else {
        const sGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, gm.radius);
        sGrad.addColorStop(0, 'rgba(239, 68, 68, 0.35)');
        sGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = sGrad;
        ctx.beginPath();
        ctx.arc(0, 0, gm.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // Draw Black Hole
    if (modifiers.blackHoleCore) {
      ctx.save();
      const centerX = WORLD_WIDTH / 2;
      const centerY = WORLD_HEIGHT / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate(performance.now() / 1000);
      
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 300);
      gradient.addColorStop(0, '#000000');
      gradient.addColorStop(0.3, '#000000');
      gradient.addColorStop(0.5, '#4c1d95');
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, 300, 0, Math.PI * 2);
      ctx.fill();

      if (blackHoleImage.complete) {
        ctx.globalAlpha = 0.6;
        ctx.drawImage(blackHoleImage, -150, -150, 300, 300);
      }
      ctx.restore();
    }

    // Draw Dimension Tears
    if (modifiers.dimensionTear) {
      dimensionTears.current.forEach(tear => {
        ctx.save();
        ctx.translate(tear.x, tear.y);
        ctx.rotate(performance.now() / 500);
        
        if (dimensionTearImage.complete) {
          ctx.drawImage(dimensionTearImage, -tear.radius / 2, -tear.radius / 2, tear.radius, tear.radius);
        } else {
          ctx.strokeStyle = '#8b5cf6';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, tear.radius / 2, 0, Math.PI * 2);
          ctx.stroke();
        }
        
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#8b5cf6';
        ctx.strokeStyle = '#a78bfa';
        ctx.lineWidth = 2;
        ctx.strokeRect(-tear.radius / 4, -tear.radius / 4, tear.radius / 2, tear.radius / 2);
        
        ctx.restore();
      });
    }

    // Draw Caution Hazard Perimeter & Corner Energy Pylons
    ctx.save();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 4;
    ctx.setLineDash([28, 28]);
    ctx.strokeRect(12, 12, WORLD_WIDTH - 24, WORLD_HEIGHT - 24);
    ctx.restore();

    const cornerPylons = [
      { x: 70, y: 70 },
      { x: WORLD_WIDTH - 70, y: 70 },
      { x: 70, y: WORLD_HEIGHT - 70 },
      { x: WORLD_WIDTH - 70, y: WORLD_HEIGHT - 70 },
    ];
    cornerPylons.forEach(cp => {
      ctx.save();
      ctx.translate(cp.x, cp.y);
      const pulseR = 34 + Math.sin(arenaNow / 240) * 6;
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Draw Armored Cover Bunkers (Enhanced Map)
    if (modifiers.enhancedMap) {
      walls.current.forEach(w => {
        ctx.save();
        // Drop shadow
        ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
        ctx.fillRect(w.x + 10, w.y + 12, w.width, w.height);

        // Metallic bunker body
        const bGrad = ctx.createLinearGradient(w.x, w.y, w.x, w.y + w.height);
        bGrad.addColorStop(0, '#475569');
        bGrad.addColorStop(0.5, '#334155');
        bGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = bGrad;
        ctx.fillRect(w.x, w.y, w.width, w.height);

        // Top armored bevel highlight
        ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
        ctx.fillRect(w.x, w.y, w.width, Math.min(18, w.height * 0.2));

        // Subtle interior armor ribs
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 2;
        for (let i = 28; i < w.width - 12; i += 44) {
          ctx.beginPath();
          ctx.moveTo(w.x + i, w.y + 10);
          ctx.lineTo(w.x + i, w.y + w.height - 10);
          ctx.stroke();
        }

        // Neon tactical trim border
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.strokeRect(w.x, w.y, w.width, w.height);

        // Corner rivets
        ctx.fillStyle = '#fbbf24';
        const rOff = 10;
        [
          [w.x + rOff, w.y + rOff],
          [w.x + w.width - rOff, w.y + rOff],
          [w.x + rOff, w.y + w.height - rOff],
          [w.x + w.width - rOff, w.y + w.height - rOff],
        ].forEach(([rx, ry]) => {
          ctx.beginPath();
          ctx.arc(rx, ry, 3.5, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      });
    }

    if (modifiers.hardMode) {
      // Glitch lines (without darkening the screen)
      if (Math.random() < 0.05) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
        ctx.fillRect(0, Math.random() * WORLD_HEIGHT, WORLD_WIDTH, 20);
      }

      // "SUFFER" overlay
      if (Math.floor(cinematicTimer.current % 12) < 1.5) {
        ctx.save();
        ctx.font = 'bold 120px Impact';
        ctx.fillStyle = 'rgba(239,68,68,0.3)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SUFFER!', cameraX + CANVAS_WIDTH / 2, cameraY + CANVAS_HEIGHT / 2);
        ctx.restore();
      }
    }

    // Boss Attack Floor Telegraphs (SLAMMING, CHERRY_CHARGE, WHEELCHAIR, OREO_SANDWICH)
    if (boss.current.state === 'SLAMMING') {
      const targetFloorY = cameraY + CANVAS_HEIGHT - boss.current.height / 2;
      const distRatio = Math.max(0, Math.min(1, (targetFloorY - boss.current.y) / Math.max(1, CANVAS_HEIGHT)));
      ctx.save();
      ctx.translate(boss.current.x, targetFloorY);
      ctx.strokeStyle = '#ef4444';
      ctx.fillStyle = 'rgba(239, 68, 68, 0.18)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, 0, 170, 56, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      const shrink = 0.25 + distRatio * 0.75;
      ctx.beginPath();
      ctx.ellipse(0, 0, 170 * shrink, 56 * shrink, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#fef08a';
      ctx.font = '900 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠ METEOR SLAM ⚠', 0, -68);
      ctx.restore();
    } else if (boss.current.state === 'CHERRY_CHARGE' || boss.current.state === 'WHEELCHAIR') {
      const chargeAngle = Math.atan2(player.current.y - boss.current.y, player.current.x - boss.current.x);
      ctx.save();
      ctx.translate(boss.current.x, boss.current.y);
      ctx.rotate(chargeAngle);
      const laneGrad = ctx.createLinearGradient(0, 0, 680, 0);
      laneGrad.addColorStop(0, boss.current.state === 'CHERRY_CHARGE' ? 'rgba(244, 63, 94, 0.32)' : 'rgba(245, 158, 11, 0.28)');
      laneGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = laneGrad;
      ctx.fillRect(0, -45, 680, 90);
      ctx.strokeStyle = boss.current.state === 'CHERRY_CHARGE' ? 'rgba(251, 113, 133, 0.55)' : 'rgba(251, 191, 36, 0.55)';
      ctx.setLineDash([18, 12]);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -45); ctx.lineTo(680, -45);
      ctx.moveTo(0, 45); ctx.lineTo(680, 45);
      ctx.stroke();
      ctx.restore();
    } else if (boss.current.state === 'OREO_SANDWICH') {
      ctx.save();
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.55)';
      ctx.setLineDash([20, 14]);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cameraX, player.current.y - 80);
      ctx.lineTo(cameraX + CANVAS_WIDTH, player.current.y - 80);
      ctx.moveTo(cameraX, player.current.y + 80);
      ctx.lineTo(cameraX + CANVAS_WIDTH, player.current.y + 80);
      ctx.stroke();
      ctx.restore();
    }
    
    // Draw Boss (Gorgotolisis)
    ctx.save();
    ctx.translate(boss.current.x, boss.current.y);
    drawBossVisuals(ctx);
    ctx.restore();

    // Draw Orbiting, Targeting & Thrown Big Macs (2D Mode)
    orbitingBurgers.current.forEach(b => {
      if (b.state === 'ORBITING') {
        ctx.save();
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.moveTo(boss.current.x, boss.current.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.restore();
      } else if (b.state === 'TARGETING') {
        ctx.save();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
        ctx.lineWidth = 3;
        ctx.setLineDash([14, 8]);
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(player.current.x, player.current.y);
        ctx.stroke();
        ctx.restore();
      } else if (b.state === 'THROWN') {
        const bAngle = Math.atan2(b.vy, b.vx);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(bAngle);
        const tGrad = ctx.createLinearGradient(0, 0, -130, 0);
        tGrad.addColorStop(0, 'rgba(245, 158, 11, 0.7)');
        tGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = tGrad;
        ctx.beginPath();
        ctx.moveTo(0, -28);
        ctx.lineTo(-130, 0);
        ctx.lineTo(0, 28);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(b.x, b.y);
      if (b.state === 'TARGETING') {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, b.width * 0.68, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.rotate(b.rotation);
      ctx.shadowColor = b.state === 'TARGETING' ? '#ef4444' : '#f59e0b';
      ctx.shadowBlur = b.state === 'TARGETING' ? 24 : 18;
      if (bigMacImage.complete && bigMacImage.naturalWidth > 0) {
        ctx.drawImage(bigMacImage, -b.width / 2, -b.height / 2, b.width, b.height);
      } else {
        ctx.font = `${b.width}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🍔', 0, 0);
      }
      ctx.restore();
    });

    // Draw Projectiles + Velocity Motion Trails & Attack Telegraphs
    projectiles.current.forEach(p => {
      // Motion trail ribbon
      if (p.trail && p.trail.length > 1) {
        ctx.save();
        const trailColor = p.isPlayer
          ? (p.isHealthy ? '74, 222, 128' : '56, 189, 248')
          : (p.isHealthy ? '74, 222, 128' : (p.isMonkBullet ? '251, 191, 36' : (p.isWhitePellet ? '186, 230, 253' : '248, 113, 113')));
        for (let ti = 0; ti < p.trail.length - 1; ti++) {
          const pt1 = p.trail[ti];
          const pt2 = p.trail[ti + 1];
          const frac = (ti + 1) / p.trail.length;
          ctx.strokeStyle = `rgba(${trailColor}, ${frac * 0.55})`;
          ctx.lineWidth = Math.max(2, p.radius * 1.15 * frac);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(pt2.x, pt2.y);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Attack-specific world-space telegraphs before rotation
      if (p.isOatmeal && p.vx === 0 && p.life !== undefined) {
        const prog = 1 - Math.max(0, Math.min(1, p.life / 1.5));
        ctx.save();
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.3 + prog * 0.65})`;
        ctx.setLineDash([12, 8]);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(player.current.x, player.current.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 1.25, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (p.isSummonGuy && p.life !== undefined) {
        const prog = Math.max(0, Math.min(1, p.life / 2.2));
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(arenaNow / 320);
        ctx.strokeStyle = prog < 0.3 ? '#ef4444' : '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * (1.05 + prog * 0.75), 0, Math.PI * 2);
        ctx.stroke();
        for (let t = 0; t < 4; t++) {
          const ta = (t * Math.PI) / 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ta) * p.radius * 1.1, Math.sin(ta) * p.radius * 1.1);
          ctx.lineTo(Math.cos(ta) * p.radius * 1.65, Math.sin(ta) * p.radius * 1.65);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.save();
      ctx.translate(p.x, p.y);

      // Deflected player salad sonic cone
      if (p.isPlayer && p.isHealthy) {
        const velAngle = Math.atan2(p.vy, p.vx);
        ctx.save();
        ctx.rotate(velAngle);
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.85)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 1.4, -0.9, 0.9);
        ctx.stroke();
        ctx.restore();
      }

      // Dongfish sine-wave swim wobble
      if (p.isDongfish) {
        ctx.rotate(Math.sin(arenaNow / 95 + p.x * 0.02) * 0.25);
      } else {
        ctx.rotate(p.rotation);
      }

      // Gun Mode player shot: Neon cyan plasma bolt!
      if (p.isPlayer && !p.isHealthy) {
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.ellipse(0, 0, p.radius * 2.2, p.radius * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(0, 0, p.radius * 1.4, p.radius * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }

      // Add a dynamic glow
      if (p.isPlayer || p.isHealthy) {
        ctx.shadowColor = '#4ade80';
        ctx.shadowBlur = 18;
      } else if (p.isOreo) {
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = 22;
      } else {
        ctx.shadowColor = '#f87171';
        ctx.shadowBlur = 12;
      }
      
      let img = junkFoodImage;
      if (p.isDongfish) img = dongfishImage;
      else if (p.isSummonGuy) img = summonGuyImage;
      else if (p.isChef) img = chefImage;
      else if (p.isOatmeal) img = oatmealImage;
      else if (p.isBigMac) img = bigMacImage;
      else if (p.isCherryCoke) img = cherryCokeImage;
      else if (p.isCreamPepsi) img = creamPepsiImage;
      else if (p.isHealthy) img = healthyFoodImage;

      const useEmojiOnly =
        !!p.isMinigun &&
        !p.isHealthy &&
        !p.isDongfish &&
        !p.isOreo &&
        !p.isChef &&
        !p.isOatmeal &&
        !p.isBigMac &&
        !p.isCherryCoke &&
        !p.isCreamPepsi &&
        p.emoji !== '🍗';

      const isMonkBullet = !!p.isMonkBullet;

      if (p.isWhitePellet) {
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e0f2fe';
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (!p.isBandAid && !isMonkBullet && !useEmojiOnly && img.complete && img.naturalWidth > 0) {
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, -p.radius * 1.2, -p.radius * 1.2, p.radius * 2.4, p.radius * 2.4);
      } else if (isMonkBullet) {
        ctx.fillStyle = '#f59e0b';
        ctx.shadowBlur = 18;
        ctx.shadowColor = '#f59e0b';
        ctx.beginPath();
        ctx.ellipse(0, 0, p.radius * 2.3, p.radius * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.ellipse(0, 0, p.radius * 1.4, p.radius * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.font = `${p.radius * 2}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.emoji, 0, 0);
      }
      ctx.restore();

      // Crackling energy rim on giant Oreos
      if (p.isOreo) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let seg = 0; seg <= 6; seg++) {
          const a = (seg / 6) * Math.PI * 2 + arenaNow / 180;
          const rad = p.radius * (seg % 2 === 0 ? 1.05 : 1.18);
          const ox = Math.cos(a) * rad;
          const oy = Math.sin(a) * rad;
          if (seg === 0) ctx.moveTo(ox, oy);
          else ctx.lineTo(ox, oy);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
    });

    // Draw Phase Dash Afterimage Ghosts
    dashGhosts.current.forEach(g => {
      const alpha = Math.max(0, (g.life / g.maxLife) * 0.55);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = g.color;
      ctx.shadowColor = g.color;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(g.x, g.y, player.current.width * 0.48, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Draw Slash / Parry / Muzzle Flash Arcs
    slashArcs.current.forEach(sa => {
      const prog = 1 - Math.max(0, sa.life / sa.maxLife);
      ctx.save();
      ctx.translate(sa.x, sa.y);
      ctx.rotate(sa.angle);
      ctx.globalAlpha = 1 - prog;
      ctx.strokeStyle = sa.color;
      ctx.shadowColor = sa.color;
      ctx.shadowBlur = 18;
      ctx.lineWidth = 7 * (1 - prog * 0.5);
      ctx.beginPath();
      ctx.arc(0, 0, sa.radius * (0.75 + prog * 0.55), -0.95, 0.95);
      ctx.stroke();
      ctx.restore();
    });

    // Draw Particles
    particles.current.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // Draw Shockwaves
    shockwaves.current.forEach(sw => {
      ctx.save();
      const progress = sw.radius / sw.maxRadius;
      ctx.globalAlpha = Math.max(0, 1 - progress);
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = sw.width * (1 - progress * 0.4);
      ctx.shadowColor = sw.color;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    // Draw Floating Combat Damage / Parry / Heal Popups
    floatingTexts.current.forEach(ft => {
      const alpha = Math.max(0, ft.life / ft.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${ft.size}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 4;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });

    // Draw Storm
    if (modifiers.storm) {
      ctx.save();
      ctx.strokeStyle = '#a855f7'; // purple-500
      ctx.lineWidth = 10;
      ctx.setLineDash([20, 10]);
      ctx.beginPath();
      ctx.arc(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, stormRadius.current, 0, Math.PI * 2);
      ctx.stroke();
      
      // Draw outer darkness
      ctx.beginPath();
      ctx.arc(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, stormRadius.current, 0, Math.PI * 2);
      ctx.rect(WORLD_WIDTH, 0, -WORLD_WIDTH, WORLD_HEIGHT);
      ctx.fillStyle = 'rgba(88, 28, 135, 0.3)'; // purple-900 with alpha
      ctx.fill();
      ctx.restore();
    }

    // 2D Cholesterol & Calorie Hyper-Beam
    if (helicopter.current.active && helicopter.current.isAmbushed && 
       (helicopter.current.phase === 'CRASHING' || (helicopter.current.phase === 'ESCAPE' && (helicopter.current.cutsceneTimer || 0) >= 0.5))) {
      const h = helicopter.current;
      const bX = boss.current.x;
      const bY = boss.current.y;
      const beamAngle = Math.atan2(h.y - bY, h.x - bX);
      const beamDist = Math.hypot(h.x - bX, h.y - bY);

      ctx.save();
      ctx.translate(bX, bY);
      ctx.rotate(beamAngle);

      // Outer blazing caloric plasma sheath
      const outerGrad = ctx.createLinearGradient(0, -50, 0, 50);
      outerGrad.addColorStop(0, 'rgba(245, 158, 11, 0)');
      outerGrad.addColorStop(0.3, 'rgba(245, 158, 11, 0.85)');
      outerGrad.addColorStop(0.5, 'rgba(239, 68, 68, 0.95)');
      outerGrad.addColorStop(0.7, 'rgba(245, 158, 11, 0.85)');
      outerGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = outerGrad;
      ctx.fillRect(0, -50, beamDist, 100);

      // Inner sizzling cholesterol laser core
      const coreGrad = ctx.createLinearGradient(0, -15, 0, 15);
      coreGrad.addColorStop(0, 'rgba(254, 240, 138, 0)');
      coreGrad.addColorStop(0.3, '#ffffff');
      coreGrad.addColorStop(0.5, '#ffffff');
      coreGrad.addColorStop(0.7, '#ffffff');
      coreGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = coreGrad;
      ctx.fillRect(0, -15, beamDist, 30);

      // Rapidly traveling junk foods and calories along the beam
      const now = performance.now();
      for (let j = 0; j < 6; j++) {
        const itemProg = ((now / 150 + j * 0.16) % 1.0);
        const itemX = itemProg * beamDist;
        const itemY = Math.sin(now / 50 + j) * 12;
        ctx.font = '28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 15;
        const emojis = ['🍔', '🍟', '🍕', '🌭', '🍩', '🥤'];
        ctx.fillText(emojis[j % emojis.length], itemX, itemY);
      }

      ctx.restore();

      // Blinding explosion sphere at helicopter impact point
      ctx.save();
      ctx.translate(h.x, h.y);
      const impactRadius = 70 + Math.sin(now / 40) * 20;
      const impactGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, impactRadius);
      impactGrad.addColorStop(0, '#ffffff');
      impactGrad.addColorStop(0.3, '#fbbf24');
      impactGrad.addColorStop(0.7, '#ef4444');
      impactGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = impactGrad;
      ctx.beginPath();
      ctx.arc(0, 0, impactRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Helicopter & Rescue Cutscene Graphics
    if (helicopter.current.active) {
      const h = helicopter.current;
      ctx.save();
      ctx.translate(h.x, h.y);
      const rot = h.rotation || (Math.sin(performance.now() / 200) * 0.05);
      ctx.rotate(rot);

      // Searchlight Beam downwards
      if (h.phase !== 'COMBAT') {
        ctx.save();
        const beamGrad = ctx.createLinearGradient(0, 20, 0, 220);
        beamGrad.addColorStop(0, 'rgba(254, 240, 138, 0.45)'); // yellow-200
        beamGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(0, 15);
        ctx.lineTo(-80, 220);
        ctx.lineTo(80, 220);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Helicopter Body
      if (helicopterImage.complete) {
        ctx.drawImage(helicopterImage, -h.width / 2, -h.height / 2, h.width, h.height);
      }

      // Monk Cartman in Cockpit
      if (cartmanImage.complete) {
        ctx.drawImage(cartmanImage, -35, -22, 65, 65);
      }

      // Fire and smoke when crashing
      if (h.phase === 'CRASHING') {
        ctx.save();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.arc(-h.width * 0.25, 0, 32 + Math.sin(performance.now() / 30) * 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Animated Spinning Rotor Blades
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      const rotorAngle = (performance.now() / 15) % (Math.PI * 2);
      ctx.ellipse(0, -h.height / 2 + 5, h.width * 0.7, 10, rotorAngle, 0, Math.PI * 2);
      ctx.stroke();

      // Animated Rope Ladder
      const ladderLen = h.ladderLength || 0;
      if (ladderLen > 10) {
        const topY = 25;
        const botY = topY + ladderLen;

        ctx.strokeStyle = '#78350f'; // Rope amber
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-16, topY);
        ctx.lineTo(-16, botY);
        ctx.moveTo(16, topY);
        ctx.lineTo(16, botY);
        ctx.stroke();

        ctx.strokeStyle = '#d97706'; // Wooden rungs
        ctx.lineWidth = 4;
        for (let rY = topY + 14; rY < botY; rY += 18) {
          ctx.beginPath();
          ctx.moveTo(-18, rY);
          ctx.lineTo(18, rY);
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    ctx.restore(); // Restore camera translation

    // Draw Cinematic Overlay Bars during Helicopter Cutscene
    if (helicopter.current.active && helicopter.current.phase && helicopter.current.phase !== 'COMBAT') {
      const h = helicopter.current;
      ctx.save();
      
      // Top Letterbox Bar
      ctx.fillStyle = '#020617'; // slate-950
      ctx.fillRect(0, 0, CANVAS_WIDTH, 65);
      
      // Bottom Letterbox Bar
      ctx.fillRect(0, CANVAS_HEIGHT - 65, CANVAS_WIDTH, 65);

      // Gold Accent lines
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(0, 63, CANVAS_WIDTH, 2);
      ctx.fillRect(0, CANVAS_HEIGHT - 65, CANVAS_WIDTH, 2);

      // Cutscene Header
      ctx.font = '900 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 12;
      ctx.fillText('🚁 MONK CARTMAN TACTICAL EVAC & ORBITAL STRIKE', CANVAS_WIDTH / 2, 40);
      ctx.shadowBlur = 0;

      // Cutscene Dialogue Subtitle text
      let subtitleText = '';
      if (h.phase === 'APPROACH') subtitleText = 'Monk Cartman: "HOLD ON KID! TACTICAL RESCUE INCOMING!"';
      else if (h.phase === 'PICKUP') subtitleText = 'Monk Cartman: "GRAB THE LADDER! WE\'RE TURNING THIS ARENA INTO SALAD DUST!"';
      else if (h.phase === 'BOMBING_RUN') subtitleText = 'Monk Cartman: "TASTE THE NUTRITIONAL FIREPOWER, GORGOTOLISIS!"';
      else if (h.phase === 'ESCAPE') {
        if (h.isAmbushed) {
          subtitleText = 'Gorgotolisis: "FOOLS! TASTE MY 10,000,000-CALORIE CHOLESTEROL HYPER-BEAM!"';
        } else {
          subtitleText = 'Monk Cartman: "RESPECT MY AUTHORITAH! MISSION ACCOMPLISHED!"';
        }
      } else if (h.phase === 'CRASHING') {
        subtitleText = 'Monk Cartman: "MAYDAY! MAYDAY! CHOLESTEROL OVERLOAD! WE\'RE CRASHINGGG!"';
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(subtitleText, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 25);

      ctx.restore();
    }

    // Moon transition text
    if (isOnMoon.current && cinematicTimer.current < 3) {
      ctx.save();
      ctx.fillStyle = 'white';
      ctx.font = 'bold 80px Arial';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'cyan';
      ctx.shadowBlur = 20;
      ctx.fillText('MOON BATTLE!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.font = 'bold 30px Arial';
      ctx.fillText('LOW GRAVITY ENGAGED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);
      ctx.restore();
    }

    // Chaos Mode display
    if (modifiers.randomChaos && cinematicTimer.current < 5) {
      ctx.save();
      ctx.fillStyle = '#fde047'; // yellow-300
      ctx.font = 'black 60px Arial';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 15;
      ctx.fillText('RANDOM CHAOS!', CANVAS_WIDTH / 2, 180);
      
      ctx.font = 'bold 24px Arial';
      ctx.fillStyle = '#ffffff';
      activeModifiers.forEach((mod, idx) => {
        ctx.fillText(`⚡ ${mod}`, CANVAS_WIDTH / 2, 230 + idx * 35);
      });
      ctx.restore();
    }
    }

    // ==========================================
    // --- FULL-SCREEN EFFECTS & POST-PROCESSING ---
    // ==========================================
    
    // 1. Critical Health Heartbeat Danger Pulse (< 35% HP)
    const playerHpRatio = player.current.health / player.current.maxHealth;
    if (playerHpRatio < 0.35) {
      ctx.save();
      const pulseRate = playerHpRatio < 0.15 ? 120 : 220;
      const pulse = (Math.sin(performance.now() / pulseRate) + 1) * 0.5;
      const dangerGrad = ctx.createRadialGradient(
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.32,
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, Math.hypot(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
      );
      dangerGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      dangerGrad.addColorStop(0.65, `rgba(185, 28, 28, ${0.12 * pulse})`);
      dangerGrad.addColorStop(1, `rgba(153, 27, 27, ${0.42 * pulse + 0.18})`);
      ctx.fillStyle = dangerGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.restore();
    }

    // 1b. Blindness Mode Flashlight / Spotlight Overlay
    if (modifiers.blindnessMode) {
      ctx.save();
      const pScreenX = modifiers.mode3D ? CANVAS_WIDTH / 2 : (player.current.x - cameraX);
      const pScreenY = modifiers.mode3D ? CANVAS_HEIGHT / 2 : (player.current.y - cameraY);
      const blindGrad = ctx.createRadialGradient(
        pScreenX, pScreenY, 70,
        pScreenX, pScreenY, 320
      );
      blindGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      blindGrad.addColorStop(0.35, 'rgba(0, 0, 0, 0.45)');
      blindGrad.addColorStop(1, 'rgba(0, 0, 0, 0.985)');
      ctx.fillStyle = blindGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.restore();
    }

    // 2. Player Damage Hit Flash & Impact Edge Vignette
    if (player.current.isHit > 0) {
      ctx.save();
      const flashAlpha = Math.min(0.45, player.current.isHit * 2.2);
      ctx.fillStyle = `rgba(220, 38, 38, ${flashAlpha})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      const hitGrad = ctx.createRadialGradient(
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.25,
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.72
      );
      hitGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      hitGrad.addColorStop(1, `rgba(239, 68, 68, ${player.current.isHit * 2.5})`);
      ctx.fillStyle = hitGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.restore();
    }

    // 3. Boss Corruption / Demon Caloric Heat Vignette (Light, non-dimming fiery glow)
    if (boss.current.corruption > 250) {
      ctx.save();
      const corrNorm = Math.min(1.0, (boss.current.corruption - 250) / 750);
      const heatPulse = 1 + Math.sin(performance.now() / 400) * 0.08;
      const corrGrad = ctx.createRadialGradient(
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.5 * heatPulse,
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, Math.hypot(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
      );
      corrGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      const r = Math.floor(230 + corrNorm * 25);
      const g = Math.floor(70 - corrNorm * 30);
      const b = 30;
      corrGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${0.05 + corrNorm * 0.12})`);
      ctx.fillStyle = corrGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.restore();
    }

    // 3b. Emerald Parry / Nutri-Pulse Screen-Edge Flash & Boss Crit Flash
    if (parryFlash.current > 0) {
      ctx.save();
      const pAlpha = Math.min(0.45, parryFlash.current * 1.4);
      const pGrad = ctx.createRadialGradient(
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.34,
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, Math.hypot(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
      );
      pGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      pGrad.addColorStop(1, `rgba(74, 222, 128, ${pAlpha})`);
      ctx.fillStyle = pGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.restore();
    }
    if (bossHitFlash.current > 0) {
      ctx.save();
      const bAlpha = Math.min(0.22, bossHitFlash.current * 1.4);
      const bGrad = ctx.createRadialGradient(
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.42,
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, Math.hypot(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
      );
      bGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      bGrad.addColorStop(1, `rgba(251, 191, 36, ${bAlpha})`);
      ctx.fillStyle = bGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.restore();
    }

    // 3c. Anime Impact Frames (Hit-stop Strobe + Jagged Manga Starburst + Chromatic Aftershock)
    drawImpactFrameOverlay(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, cameraX, cameraY);

    // 4. Action Speed Lines (Anime/Velocity Warp)
    const isHighSpeed = dashTimer.current > 0 || (player.current.speed > 350 && (Math.hypot(player.current.vx || 0, player.current.vy || 0) > 80)) ||
                        boss.current.state === 'CHERRY_CHARGE' ||
                        boss.current.state === 'WHEELCHAIR' ||
                        boss.current.state === 'SLAMMING';
    if (isHighSpeed) {
      ctx.save();
      const lineCount = 24;
      const cx = CANVAS_WIDTH / 2;
      const cy = CANVAS_HEIGHT / 2;
      const now = performance.now();
      ctx.strokeStyle = boss.current.state === 'CHERRY_CHARGE' ? 'rgba(244, 63, 94, 0.45)' : 
                        (boss.current.state === 'SLAMMING' ? 'rgba(245, 158, 11, 0.5)' : 'rgba(255, 255, 255, 0.28)');
      ctx.lineWidth = 2.5;
      for (let s = 0; s < lineCount; s++) {
        const seed = (s * 37 + Math.floor(now / 35)) % 100;
        if (seed > 55) {
          const angle = (s / lineCount) * Math.PI * 2 + (now * 0.0008);
          const r1 = Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.36 + (seed % 40);
          const r2 = Math.hypot(cx, cy) * 0.98;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
          ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 5. Boss Attack-Specific Atmosphere Overlays
    if (boss.current.state === 'SODA_BLAST') {
      ctx.save();
      const laserFlicker = Math.sin(performance.now() / 25);
      ctx.fillStyle = `rgba(56, 189, 248, ${0.08 + Math.abs(laserFlicker) * 0.08})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      // Horizontal laser scanline surges
      ctx.fillStyle = 'rgba(186, 230, 253, 0.22)';
      const barY = (performance.now() * 0.45) % CANVAS_HEIGHT;
      ctx.fillRect(0, barY, CANVAS_WIDTH, 6);
      ctx.fillRect(0, (barY + CANVAS_HEIGHT * 0.5) % CANVAS_HEIGHT, CANVAS_WIDTH, 4);
      ctx.restore();
    } else if (boss.current.state === 'EARTHQUAKE_CRACK' || boss.current.state === 'SMASH_2') {
      ctx.save();
      const seismicFlicker = Math.sin(performance.now() / 45);
      ctx.fillStyle = `rgba(180, 83, 9, ${0.07 + Math.abs(seismicFlicker) * 0.05})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.restore();
    }

    // 6. Floating Atmospheric Camera Sparks & Embers
    ctx.save();
    const isEmberMode = boss.current.corruption > 400 || boss.current.state === 'RAGE' || boss.current.state === 'ULTIMATE_SPAM';
    const nowTime = performance.now();
    const emberCount = isEmberMode ? 28 : 12;
    for (let e = 0; e < emberCount; e++) {
      const ex = (Math.sin(e * 71 + nowTime * 0.0003) * 0.5 + 0.5) * CANVAS_WIDTH;
      const ey = ((e * 193 - nowTime * (isEmberMode ? 0.06 : 0.025)) % CANVAS_HEIGHT + CANVAS_HEIGHT) % CANVAS_HEIGHT;
      const size = (e % 3) + 1.5;
      const emberAlpha = isEmberMode ? (0.4 + (e % 5) * 0.12) : 0.25;
      ctx.fillStyle = isEmberMode 
        ? ((e % 2 === 0) ? `rgba(251, 146, 60, ${emberAlpha})` : `rgba(239, 68, 68, ${emberAlpha})`)
        : `rgba(148, 163, 184, ${emberAlpha})`;
      ctx.beginPath();
      ctx.arc(ex, ey, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 7. Subtle Ambient Screen Polish (Bright & Clear, zero darkening)
    ctx.save();
    const cornerGrad = ctx.createRadialGradient(
      CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.65,
      CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, Math.hypot(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
    );
    cornerGrad.addColorStop(0, 'rgba(255, 255, 255, 0.04)');
    cornerGrad.addColorStop(1, 'rgba(0, 0, 0, 0.05)');
    ctx.fillStyle = cornerGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();

    // --- UI Layer (Interactive Battle HUD handled via React Overlay; draw player sprite & tactical radar on canvas) ---

    // Draw Player (Hidden in 1st Person 3D Mode)
    if (!modifiers.mode3D) {
      ctx.save();
      const playerScreenX = player.current.x - cameraX;
      const playerScreenY = player.current.y - cameraY;

      // Player Ground Shadow
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(playerScreenX, playerScreenY + player.current.height / 2 - 2, player.current.width * 0.45, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Dash Invulnerability Energy Shield Ring
      if (dashInvuln.current > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 18;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(playerScreenX, playerScreenY, player.current.width * 0.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Low Health Warning Aura (below 35% HP)
      const playerHpRatio = player.current.health / player.current.maxHealth;
      if (playerHpRatio < 0.35) {
        ctx.save();
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.4 + Math.sin(performance.now() / 100) * 0.3})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(playerScreenX, playerScreenY, player.current.width * 0.75, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (player.current.stunTimer > 0) {
        // Draw stun effect
        ctx.save();
        ctx.translate(playerScreenX, playerScreenY - 40);
        const stunRot = performance.now() / 100;
        ctx.rotate(stunRot);
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💫', 0, 0);
        ctx.restore();
      }

      // Locomotion tilt and step bobbing
      const runVelocityX = player.current.vx || 0;
      const runTilt = Math.max(-0.25, Math.min(0.25, runVelocityX * 0.0003));
      const isMoving = Math.hypot(player.current.vx || 0, player.current.vy || 0) > 10;
      const stepBob = isMoving ? Math.sin(performance.now() / 90) * 3 : 0;

      ctx.translate(playerScreenX, playerScreenY + stepBob);
      ctx.rotate(runTilt);

      if (player.current.isHit > 0) {
        ctx.filter = 'brightness(2) sepia(1) hue-rotate(-50deg) saturate(5)';
      }

      const activeSkin = SHOP_SKINS.find(s => s.id === currentSkin.current) || SHOP_SKINS[0];

      if (activeSkin.type === 'image') {
        const img = skinImages[activeSkin.id];
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, -player.current.width / 2, -player.current.height / 2, player.current.width, player.current.height);
        } else {
          // Fallback or loading state
          ctx.font = `${player.current.width}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('⏳', 0, 0);
        }
      } else {
        ctx.font = `${player.current.width}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(activeSkin.value, 0, 0);
      }
      
      ctx.restore();
    }

    // Tactical Arena Minimap Radar (Bottom-Right Corner)
    if (!modifiers.mobile && CANVAS_WIDTH >= 640 && CANVAS_HEIGHT >= 480) {
      const mapSize = 132;
      const mapX = CANVAS_WIDTH - mapSize - 18;
      const mapY = CANVAS_HEIGHT - mapSize - 18;
      const scaleX = mapSize / WORLD_WIDTH;
      const scaleY = mapSize / WORLD_HEIGHT;

      ctx.save();
      ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = 2;
      ctx.fillRect(mapX, mapY, mapSize, mapSize);
      ctx.strokeRect(mapX, mapY, mapSize, mapSize);

      // Quadrant crosshairs
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mapX + mapSize / 2, mapY);
      ctx.lineTo(mapX + mapSize / 2, mapY + mapSize);
      ctx.moveTo(mapX, mapY + mapSize / 2);
      ctx.lineTo(mapX + mapSize, mapY + mapSize / 2);
      ctx.stroke();

      // Walls on radar
      if (modifiers.enhancedMap) {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
        walls.current.forEach(w => {
          ctx.fillRect(mapX + w.x * scaleX, mapY + w.y * scaleY, Math.max(2, w.width * scaleX), Math.max(2, w.height * scaleY));
        });
      }

      // Dimension Tears on radar
      if (modifiers.dimensionTear) {
        ctx.fillStyle = '#a855f7';
        dimensionTears.current.forEach(tear => {
          ctx.beginPath();
          ctx.arc(mapX + tear.x * scaleX, mapY + tear.y * scaleY, 3.5, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Storm boundary on radar
      if (modifiers.storm) {
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.75)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(mapX + mapSize / 2, mapY + mapSize / 2, stormRadius.current * scaleX, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Boss pulsing radar ping
      const bx = mapX + Math.max(4, Math.min(mapSize - 4, boss.current.x * scaleX));
      const by = mapY + Math.max(4, Math.min(mapSize - 4, boss.current.y * scaleY));
      const pingR = 5 + ((performance.now() / 140) % 6);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(bx, by, pingR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Player radar marker (+ 3D view cone when in 3D mode)
      const px = mapX + Math.max(3, Math.min(mapSize - 3, player.current.x * scaleX));
      const py = mapY + Math.max(3, Math.min(mapSize - 3, player.current.y * scaleY));
      if (modifiers.mode3D) {
        const viewAngle = cameraAngle.current - Math.PI / 2;
        ctx.fillStyle = 'rgba(74, 222, 128, 0.25)';
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.arc(px, py, 20, viewAngle - 0.5, viewAngle + 0.5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('ARENA RADAR', mapX + 6, mapY + 12);
      ctx.restore();
    }
  };

  const loop = (time: number) => {
    if (!lastTime.current) lastTime.current = time;
    const dt = (time - lastTime.current) / 1000;
    lastTime.current = time;

    update(dt);

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) draw(ctx);
    }

    requestRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState]);

  const triggerDashRef = useRef(triggerDash);
  triggerDashRef.current = triggerDash;
  const triggerNutriPulseRef = useRef(triggerNutriPulse);
  triggerNutriPulseRef.current = triggerNutriPulse;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
      const key = e.key.toLowerCase();
      keys.current[key] = true; 

      if (e.key === 'Shift' && !e.repeat) {
        triggerDashRef.current();
      }
      if (key === 'f' && !e.repeat) {
        triggerNutriPulseRef.current();
      }
      
      // Z key press: Skip Intro Cinematic or Cutscenes
      if (key === 'z') {
        if (entranceCutscene.current.active) {
          finishEntranceCutscene(true);
          return;
        }
        if (phase2Cutscene.current.active) {
          finishPhase2Cinematic();
          return;
        }
        if (phase3Cutscene.current.active) {
          finishPhase3Cinematic();
          return;
        }
        if (deathCutscene.current.active) {
          finishDeathCutscene();
          return;
        }
        if (gameState === 'DIALOGUE' || gameState === 'VIDEO_CINEMATIC') {
          setGameState('PLAYING');
        } else if (helicopter.current.active && helicopter.current.phase && helicopter.current.phase !== 'COMBAT') {
          if (helicopter.current.isAmbushed) {
            player.current.health = 0;
            helicopter.current.active = false;
            helicopter.current.phase = 'FINISHED';
            setDeathCause('CHOLESTEROL_BEAM');
            stopGame('GAME_OVER');
          } else {
            isRescueEnding.current = true;
            helicopter.current.active = false;
            helicopter.current.phase = 'FINISHED';
            stopGame('VICTORY');
          }
        }
      }

      // Cheat code detection
      cheatBuffer.current += key;
      if (cheatBuffer.current.endsWith('gorg')) {
        godMode.current = !godMode.current;
        setIsGodModeActive(godMode.current);
        cheatBuffer.current = '';
        if (!godMode.current) setShowAdminPanel(false);
        // Visual feedback for cheat
        spawnParticles(player.current.x, player.current.y, '#fbbf24', 30);
        battleSfxRef.current?.playHeal();
      }
      if (cheatBuffer.current.length > 10) {
        cheatBuffer.current = cheatBuffer.current.slice(-10);
      }

      if (e.key === 'Escape') {
        if (entranceCutscene.current.active || phase2Cutscene.current.active || phase3Cutscene.current.active || deathCutscene.current.active) return;
        if (document.pointerLockElement) {
          document.exitPointerLock?.();
          return;
        }
        if (gameState === 'PLAYING') {
          setIsPaused(prev => !prev);
          battleSfxRef.current?.playUiClick();
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  const requestPointerLock = () => {
    if (modifiers.mode3D && canvasRef.current) {
      if (document.pointerLockElement !== canvasRef.current) {
        try {
          canvasRef.current.requestPointerLock?.();
        } catch (err) {
          console.warn("Pointer lock error:", err);
        }
      }
    }
  };

  useEffect(() => {
    const handlePointerLockChange = () => {
      const isLocked = document.pointerLockElement === canvasRef.current;
      setIsPointerLocked(isLocked);
    };

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (modifiers.mode3D && gameState === 'PLAYING' && !isPaused) {
        const isLocked = document.pointerLockElement === canvasRef.current;
        if (isLocked) {
          const mX = e.movementX ?? (e as any).mozMovementX ?? (e as any).webkitMovementX ?? 0;
          const mY = e.movementY ?? (e as any).mozMovementY ?? (e as any).webkitMovementY ?? 0;
          if (mX !== 0) {
            cameraAngle.current += mX * 0.0028;
          }
          if (mY !== 0) {
            cameraPitch.current = Math.max(-250, Math.min(250, cameraPitch.current - mY * 0.8));
          }
        }
      }
    };

    document.addEventListener('pointerlockchange', handlePointerLockChange);
    window.addEventListener('mousemove', handleWindowMouseMove);

    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      window.removeEventListener('mousemove', handleWindowMouseMove);
    };
  }, [modifiers.mode3D, gameState, isPaused]);

  useEffect(() => {
    const engine = new MenuMusicEngine(() => {
      setMenuMusicActive(engine.isPlaying());
    });
    menuMusicRef.current = engine;

    const sfx = new BattleSfxEngine();
    battleSfxRef.current = sfx;

    return () => {
      engine.dispose();
      menuMusicRef.current = null;
      sfx.dispose();
      battleSfxRef.current = null;
      cleanupDeathAudio();
    };
  }, []);

  useEffect(() => {
    battleSfxRef.current?.setMuted(sfxMuted);
  }, [sfxMuted]);

  useEffect(() => {
    if (battleAudioRef.current) {
      battleAudioRef.current.muted = battleMusicMuted;
    }
  }, [battleMusicMuted, gameState, isDeathCutscene]);

  useEffect(() => {
    const engine = menuMusicRef.current;
    if (!engine) return;

    if (gameState !== 'START') {
      engine.stop();
      return;
    }

    let cancelled = false;
    const tryStart = async () => {
      if (cancelled || gameState !== 'START') return;
      engine.setMuted(menuMusicMuted);
      const started = await engine.start();
      if (!cancelled) {
        setMenuMusicActive(started && !menuMusicMuted);
      }
    };

    tryStart();

    const unlock = () => {
      tryStart();
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);

    return () => {
      cancelled = true;
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [gameState, menuMusicMuted]);

  const toggleMenuMusic = async () => {
    const engine = menuMusicRef.current;
    if (!engine) return;
    if (!menuMusicMuted && !menuMusicActive) {
      const started = await engine.start();
      setMenuMusicActive(started);
      return;
    }
    const nextMuted = !menuMusicMuted;
    setMenuMusicMuted(nextMuted);
    engine.setMuted(nextMuted);
    if (!nextMuted) {
      const started = await engine.start();
      setMenuMusicActive(started);
    } else {
      setMenuMusicActive(false);
    }
  };

  useEffect(() => {
    if ((gameState !== 'PLAYING' || isPaused) && document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  }, [gameState, isPaused]);

  useEffect(() => {
    // Resize Observer for full screen
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
        dimensionsRef.current = { width, height };
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const newX = (e.clientX - rect.left) * scaleX;
    const newY = (e.clientY - rect.top) * scaleY;

    if (modifiers.mode3D && !document.pointerLockElement) {
      const deltaX = newX - mousePos.current.x;
      const deltaY = newY - mousePos.current.y;
      if (Math.abs(deltaX) < 100) {
        cameraAngle.current += deltaX * 0.005;
      }
      if (Math.abs(deltaY) < 100) {
        cameraPitch.current = Math.max(-250, Math.min(250, cameraPitch.current - deltaY * 0.5));
      }
    }

    mousePos.current = { x: newX, y: newY };
  };

  return (
    <div className="relative w-full h-screen bg-slate-950 overflow-hidden font-sans selection:bg-transparent">
      
      {/* Active Battle Music Track (keeps playing during Entrance & Phase 2 cutscenes, stops for Death cutscene) */}
      {gameState !== 'START' && gameState !== 'GAME_OVER' && gameState !== 'VICTORY' && !isDeathCutscene && (
        <audio
          ref={battleAudioRef}
          src="https://files.catbox.moe/uw3lcn.mp4"
          autoPlay
          loop
          playsInline
          muted={battleMusicMuted}
          onLoadedMetadata={(e) => {
            if (pendingBossMusicSeekRef.current !== null) {
              e.currentTarget.currentTime = pendingBossMusicSeekRef.current;
              pendingBossMusicSeekRef.current = null;
            }
          }}
          onCanPlay={(e) => {
            if (pendingBossMusicSeekRef.current !== null) {
              e.currentTarget.currentTime = pendingBossMusicSeekRef.current;
              pendingBossMusicSeekRef.current = null;
            }
          }}
        />
      )}
      
      {/* Background Music Stream */}
      {musicPlaying && (
        <div className="fixed bottom-0 right-0 w-[1px] h-[1px] opacity-0 overflow-hidden z-[100]">
          <iframe 
            src={`https://streamable.com/e/etj1p8?autoplay=1&muted=${battleMusicMuted ? 1 : 0}&loop=1${bossMusicStartAt22 ? '&t=22' : ''}`}
            width="100%" 
            height="100%" 
            frameBorder="0" 
            allow="autoplay" 
            allowFullScreen
            title="music"
          />
        </div>
      )}

      <div ref={containerRef} className="absolute inset-0 w-full h-full bg-slate-900">
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          style={{ filter: 'brightness(1.22) contrast(1.04)' }}
          className={`block w-full h-full ${modifiers.mode3D ? (isPointerLocked ? 'cursor-none' : 'cursor-pointer') : 'cursor-crosshair'}`}
          onClick={requestPointerLock}
          onMouseMove={handleMouseMove}
          onMouseDown={() => { isMouseDown.current = true; }}
          onMouseUp={() => { isMouseDown.current = false; }}
          onMouseLeave={() => { isMouseDown.current = false; }}
          onContextMenu={(e) => e.preventDefault()}
        />

        {isEntranceCutscene && gameState === 'PLAYING' && (
          <div className="absolute top-4 right-4 z-50">
            <button
              onClick={() => finishEntranceCutscene(true)}
              className="px-4 py-1.5 bg-slate-950/85 hover:bg-slate-900 text-white font-bold text-xs rounded-full border border-amber-400/60 flex items-center gap-2 uppercase tracking-wider backdrop-blur-md shadow-xl transition-transform hover:scale-105"
            >
              <span className="px-1.5 py-0.5 bg-amber-400 text-slate-950 font-black rounded text-[10px]">Z</span>
              <span>Skip Intro</span>
            </button>
          </div>
        )}

        {isPhase2Cutscene && gameState === 'PLAYING' && (
          <div className="absolute top-4 right-4 z-50">
            <button
              onClick={finishPhase2Cinematic}
              className="px-4 py-1.5 bg-slate-950/85 hover:bg-slate-900 text-white font-bold text-xs rounded-full border border-amber-400/60 flex items-center gap-2 uppercase tracking-wider backdrop-blur-md shadow-xl transition-transform hover:scale-105"
            >
              <span className="px-1.5 py-0.5 bg-amber-400 text-slate-950 font-black rounded text-[10px]">Z</span>
              <span>Skip Cutscene</span>
            </button>
          </div>
        )}

        {isPhase3Cutscene && gameState === 'PLAYING' && (
          <div className="absolute top-4 right-4 z-50">
            <button
              onClick={finishPhase3Cinematic}
              className="px-4 py-1.5 bg-slate-950/85 hover:bg-slate-900 text-white font-bold text-xs rounded-full border border-fuchsia-400/70 flex items-center gap-2 uppercase tracking-wider backdrop-blur-md shadow-xl transition-transform hover:scale-105"
            >
              <span className="px-1.5 py-0.5 bg-fuchsia-400 text-slate-950 font-black rounded text-[10px]">Z</span>
              <span>Skip Cutscene</span>
            </button>
          </div>
        )}

        {isDeathCutscene && gameState === 'PLAYING' && (
          <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
            <div className="px-3 py-1.5 bg-slate-950/80 border border-amber-400/40 rounded-full text-amber-300 font-mono text-xs tracking-wider backdrop-blur-md">
              {Math.floor(deathCutsceneSec / 60)}:{String(deathCutsceneSec % 60).padStart(2, '0')} / 1:00
            </div>
            <button
              onClick={finishDeathCutscene}
              className="px-4 py-1.5 bg-slate-950/85 hover:bg-slate-900 text-white font-bold text-xs rounded-full border border-amber-400/60 flex items-center gap-2 uppercase tracking-wider backdrop-blur-md shadow-xl transition-transform hover:scale-105"
            >
              <span className="px-1.5 py-0.5 bg-amber-400 text-slate-950 font-black rounded text-[10px]">Z</span>
              <span>Skip Cutscene</span>
            </button>
          </div>
        )}

        {modifiers.mode3D && gameState === 'PLAYING' && !isPointerLocked && !isPaused && !isDeathCutscene && !isPhase2Cutscene && !isPhase3Cutscene && !isEntranceCutscene && (
          <div 
            onClick={requestPointerLock}
            className="absolute top-28 left-1/2 -translate-x-1/2 px-6 py-2 bg-indigo-950/95 border-2 border-indigo-400 text-white rounded-full shadow-[0_0_30px_rgba(99,102,241,0.6)] font-black text-xs sm:text-sm cursor-pointer z-30 animate-pulse flex items-center gap-2 hover:bg-indigo-900 transition-all hover:scale-105 select-none"
          >
            <span>🔒 Click screen to lock mouse & look around</span>
          </div>
        )}

        {/* Interactive Battle UI HUD */}
        {gameState === 'PLAYING' && !isEntranceCutscene && !isPhase2Cutscene && !isPhase3Cutscene && !isDeathCutscene && !isPaused && (() => {
          const bossHpPct = Math.max(0, Math.min(100, (battleHud.bossHealth / battleHud.bossMaxHealth) * 100));
          const bossTrailPct = Math.max(bossHpPct, Math.min(100, (battleHud.bossTrailHealth / battleHud.bossMaxHealth) * 100));
          const playerHpPct = Math.max(0, Math.min(100, (battleHud.playerHealth / battleHud.playerMaxHealth) * 100));
          const playerTrailPct = Math.max(playerHpPct, Math.min(100, (battleHud.playerTrailHealth / battleHud.playerMaxHealth) * 100));
          const iReadyPct = Math.min(100, (battleHud.bossCorruption / (modifiers.accurateMode ? 75000 : 100000)) * 100);
          const iReadyDisplay = Math.floor(battleHud.bossCorruption / 100);

          const stateMeta: Record<Boss['state'], { label: string; cls: string }> = {
            NORMAL: { label: 'PURSUIT', cls: 'bg-slate-800/90 text-slate-300 border-slate-600' },
            SLAMMING: { label: 'METEOR SLAM', cls: 'bg-red-600/30 text-red-200 border-red-400 animate-pulse' },
            RISING: { label: 'ASCENDING', cls: 'bg-sky-600/30 text-sky-200 border-sky-400' },
            SUMMONING_DONGFISH: { label: 'SWARM SUMMON', cls: 'bg-cyan-600/30 text-cyan-200 border-cyan-400' },
            OREO_SANDWICH: { label: 'OREO CRUSH', cls: 'bg-purple-600/35 text-purple-200 border-purple-400 animate-pulse' },
            CHEF_SPIN: { label: 'CHEF VORTEX', cls: 'bg-orange-600/30 text-orange-200 border-orange-400' },
            OATMEAL_WALL: { label: 'OATMEAL BARRIER', cls: 'bg-amber-600/30 text-amber-200 border-amber-400' },
            ULTIMATE_SPAM: { label: 'ULTIMATE SPAM', cls: 'bg-rose-600/40 text-rose-100 border-rose-400 animate-pulse' },
            CHERRY_CHARGE: { label: 'CHERRY RUSH', cls: 'bg-pink-600/35 text-pink-200 border-pink-400 animate-pulse' },
            DIZZY: { label: 'STAGGERED', cls: 'bg-yellow-500/30 text-yellow-200 border-yellow-400' },
            RAGE: { label: 'ENRAGED', cls: 'bg-red-600/40 text-red-100 border-red-400' },
            WHEELCHAIR: { label: 'TURBO CHARGE', cls: 'bg-amber-600/35 text-amber-100 border-amber-400' },
            SMASH_2: { label: 'MEGA SMASH', cls: 'bg-orange-700/40 text-orange-100 border-orange-400 animate-pulse' },
            SODA_BLAST: { label: 'SODA LASER', cls: 'bg-sky-500/35 text-sky-100 border-sky-300 animate-pulse' },
            EARTHQUAKE_CRACK: { label: 'EARTHQUAKE', cls: 'bg-amber-700/40 text-amber-100 border-amber-400 animate-pulse' },
            ENTRANCE_CHICKEN: { label: 'DESCENDING', cls: 'bg-amber-500/30 text-amber-200 border-amber-400' },
            SUMMON_GUY: { label: 'MINION SUMMON', cls: 'bg-sky-600/35 text-sky-200 border-sky-400 animate-pulse' },
            MINIGUN_BARRAGE: { label: '55 RPS MINIGUN', cls: 'bg-fuchsia-600/45 text-fuchsia-100 border-fuchsia-400 animate-pulse' },
            CALORIE_SPIRAL: { label: 'CALORIE SPIRAL', cls: 'bg-purple-600/40 text-purple-100 border-purple-400 animate-pulse' },
            JUNK_METEOR_SHOWER: { label: 'JUNK METEOR SHOWER', cls: 'bg-amber-600/40 text-amber-100 border-amber-300 animate-pulse' },
            GREASE_SUPERNOVA: { label: 'GREASE SUPERNOVA', cls: 'bg-rose-600/45 text-rose-100 border-rose-400 animate-pulse' },
            CALORIE_BLACK_HOLE: { label: 'CALORIE SINGULARITY', cls: 'bg-violet-700/50 text-violet-100 border-violet-300 animate-pulse' },
          };
          const activeStateMeta = stateMeta[battleHud.bossState] || stateMeta.NORMAL;

          const dashReady = battleHud.dashCd <= 0.05;
          const dashFillPct = dashReady ? 100 : Math.max(0, 100 - (battleHud.dashCd / battleHud.dashMaxCd) * 100);
          const pulseReady = battleHud.pulseCd <= 0.05;
          const pulseFillPct = pulseReady ? 100 : Math.max(0, 100 - (battleHud.pulseCd / battleHud.pulseMaxCd) * 100);
          const playerCritical = playerHpPct < 35;

          return (
            <div className="pointer-events-none absolute inset-0 z-30 select-none">
              {/* Top-Center Boss Command Bar */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[92%] max-w-[560px]">
                <div className="bg-slate-950/75 backdrop-blur-md border border-slate-700/80 rounded-2xl px-4 py-2.5 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs sm:text-sm font-black tracking-wider uppercase text-white truncate drop-shadow">
                        {modifiers.monkCartmanMode
                          ? battleHud.bossPhase >= 3
                            ? 'Monk Cartman, Calories Unleashed'
                            : 'Monk Cartman'
                          : battleHud.bossPhase >= 3
                          ? 'Gorgotolisis, Calories Unleashed'
                          : 'Gorgotolisis'}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded border ${
                          battleHud.bossPhase >= 3
                            ? 'bg-fuchsia-500/30 text-fuchsia-200 border-fuchsia-400/80 shadow-[0_0_14px_rgba(217,70,239,0.5)]'
                            : battleHud.bossPhase >= 2
                            ? 'bg-amber-500/25 text-amber-300 border-amber-400/70 shadow-[0_0_12px_rgba(251,191,36,0.35)]'
                            : 'bg-red-500/20 text-red-300 border-red-400/50'
                        }`}
                      >
                        {battleHud.bossPhase >= 3 ? 'Stage III' : battleHud.bossPhase >= 2 ? 'Phase II' : 'Phase I'}
                      </span>
                      <span className={`hidden sm:inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${activeStateMeta.cls}`}>
                        {activeStateMeta.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-mono font-bold">
                      <span className="text-emerald-300/90">+{battleHud.bossRegen}/s</span>
                      <span className="text-slate-200">
                        {Math.ceil(battleHud.bossHealth).toLocaleString()}
                        <span className="text-slate-500">/{battleHud.bossMaxHealth.toLocaleString()}</span>
                      </span>
                    </div>
                  </div>

                  {/* Boss HP Track with Delayed White Damage Trail */}
                  <div className="relative h-3.5 w-full rounded-full bg-slate-900/95 border border-red-950/80 overflow-hidden shadow-inner">
                    <div
                      className="absolute inset-y-0 left-0 bg-white/80 transition-[width] duration-150 ease-out"
                      style={{ width: `${bossTrailPct}%` }}
                    />
                    <div
                      className={`absolute inset-y-0 left-0 transition-[width] duration-75 ${
                        battleHud.bossPhase >= 3
                          ? 'bg-gradient-to-r from-purple-600 via-fuchsia-500 to-amber-400 shadow-[0_0_18px_rgba(217,70,239,0.75)]'
                          : battleHud.bossPhase >= 2
                          ? 'bg-gradient-to-r from-red-600 via-orange-500 to-amber-400 shadow-[0_0_16px_rgba(249,115,22,0.7)]'
                          : 'bg-gradient-to-r from-rose-700 via-red-500 to-orange-400 shadow-[0_0_12px_rgba(239,68,68,0.6)]'
                      }`}
                      style={{ width: `${bossHpPct}%` }}
                    />
                    <div
                      className="absolute inset-0 opacity-25"
                      style={{
                        backgroundImage:
                          'repeating-linear-gradient(90deg, transparent, transparent 24%, rgba(2,6,23,0.9) 24%, rgba(2,6,23,0.9) 25%)',
                      }}
                    />
                  </div>

                  {/* I-Ready Test Score Gauge */}
                  {!modifiers.classicMode && (
                    <div className="mt-2 flex items-center gap-2.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 whitespace-nowrap">
                        I-Ready
                      </span>
                      <div className="relative flex-1 h-2 rounded-full bg-indigo-950/90 border border-indigo-800/70 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-[width] duration-150 bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-rose-500 shadow-[0_0_10px_rgba(168,85,247,0.6)]"
                          style={{ width: `${iReadyPct}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono font-black text-fuchsia-300 min-w-[46px] text-right">
                        {iReadyDisplay}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Top-Right Interactive Quick Battle Controls */}
              <div className="pointer-events-auto absolute top-3 right-3 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = !sfxMuted;
                    setSfxMuted(next);
                    if (!next) {
                      battleSfxRef.current?.setMuted(false);
                      battleSfxRef.current?.playUiClick();
                    }
                  }}
                  className={`px-2.5 py-2 rounded-xl border text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 backdrop-blur-md shadow-lg transition-all hover:scale-105 active:scale-95 ${
                    sfxMuted
                      ? 'bg-slate-950/80 border-slate-700 text-slate-400 hover:text-white'
                      : 'bg-slate-950/85 border-emerald-500/50 text-emerald-300 hover:border-emerald-400'
                  }`}
                  title={sfxMuted ? 'Unmute Combat SFX' : 'Mute Combat SFX'}
                >
                  {sfxMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                  <span className="hidden md:inline text-[11px]">SFX</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    battleSfxRef.current?.playUiClick();
                    setBattleMusicMuted((prev) => !prev);
                  }}
                  className={`px-2.5 py-2 rounded-xl border text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 backdrop-blur-md shadow-lg transition-all hover:scale-105 active:scale-95 ${
                    battleMusicMuted
                      ? 'bg-slate-950/80 border-slate-700 text-slate-400 hover:text-white'
                      : 'bg-slate-950/85 border-amber-500/50 text-amber-300 hover:border-amber-400'
                  }`}
                  title={battleMusicMuted ? 'Unmute Boss Music' : 'Mute Boss Music'}
                >
                  <Music size={15} className={battleMusicMuted ? 'opacity-50' : ''} />
                  <span className="hidden md:inline text-[11px]">{battleMusicMuted ? 'Music Off' : 'Music'}</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    battleSfxRef.current?.playUiClick();
                    setIsPaused(true);
                  }}
                  className="px-2.5 py-2 rounded-xl border bg-slate-950/85 border-slate-600/80 hover:border-sky-400 text-slate-200 hover:text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 backdrop-blur-md shadow-lg transition-all hover:scale-105 active:scale-95"
                  title="Pause Game (ESC)"
                >
                  <Pause size={15} />
                  <span className="hidden md:inline text-[11px]">Pause</span>
                </button>
              </div>

              {/* Bottom-Left Interactive Player Vitals & Combat Abilities Dock */}
              <div
                className={`pointer-events-auto absolute left-4 ${
                  modifiers.mobile ? 'bottom-56' : 'bottom-4'
                } flex flex-col gap-2 w-[268px] sm:w-[300px]`}
              >
                {/* Status Badges Row (Combo + God Mode / Shield + Gun Mode) */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {battleHud.combo >= 2 && (
                    <div className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500/30 to-emerald-500/30 border border-amber-400/70 text-amber-200 text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-[0_0_16px_rgba(251,191,36,0.3)]">
                      <Flame size={13} className="text-amber-300" />
                      <span>{battleHud.combo}x Combo</span>
                    </div>
                  )}
                  {(godMode.current || modifiers.godMode) && (
                    <div className="px-2 py-0.5 rounded-lg bg-amber-500/25 border border-amber-400 text-amber-200 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                      <Shield size={11} />
                      <span>God Mode</span>
                    </div>
                  )}
                  {battleHud.isInvuln && !(godMode.current || modifiers.godMode) && (
                    <div className="px-2 py-0.5 rounded-lg bg-sky-500/25 border border-sky-400 text-sky-200 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                      <Shield size={11} />
                      <span>Phase Shield</span>
                    </div>
                  )}
                  {modifiers.gunMode && (
                    <div className="px-2 py-0.5 rounded-lg bg-cyan-500/20 border border-cyan-400/60 text-cyan-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                      <Crosshair size={11} />
                      <span>[Space] Laser</span>
                    </div>
                  )}
                </div>

                {/* Player Health Card */}
                <div
                  className={`bg-slate-950/80 backdrop-blur-md border rounded-2xl px-3.5 py-2.5 shadow-xl ${
                    playerCritical ? 'border-red-500/80 shadow-[0_0_20px_rgba(239,68,68,0.35)]' : 'border-slate-700/80'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                    <span className={`uppercase tracking-wider font-black ${playerCritical ? 'text-red-300 animate-pulse' : 'text-emerald-300'}`}>
                      Vitality
                    </span>
                    <span className="font-mono text-white">
                      {Math.ceil(battleHud.playerHealth)}
                      <span className="text-slate-400"> / {battleHud.playerMaxHealth}</span>
                    </span>
                  </div>
                  <div className="relative h-3 w-full rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-white/75 transition-[width] duration-150 ease-out"
                      style={{ width: `${playerTrailPct}%` }}
                    />
                    <div
                      className={`absolute inset-y-0 left-0 transition-[width] duration-75 ${
                        playerCritical
                          ? 'bg-gradient-to-r from-red-600 to-rose-400'
                          : playerHpPct < 60
                            ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                            : 'bg-gradient-to-r from-emerald-600 to-green-400'
                      }`}
                      style={{ width: `${playerHpPct}%` }}
                    />
                  </div>
                </div>

                {/* Interactive Combat Abilities */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerDash();
                    }}
                    disabled={!dashReady}
                    className={`relative overflow-hidden rounded-xl border px-2.5 py-2 text-left transition-all backdrop-blur-md ${
                      dashReady
                        ? 'bg-slate-950/85 border-sky-400/70 hover:border-sky-300 hover:scale-[1.03] active:scale-95 shadow-[0_0_16px_rgba(56,189,248,0.28)] cursor-pointer'
                        : 'bg-slate-950/70 border-slate-700/70 opacity-80 cursor-not-allowed'
                    }`}
                  >
                    <div
                      className="absolute inset-y-0 left-0 bg-sky-500/15 transition-[width] duration-75"
                      style={{ width: `${dashFillPct}%` }}
                    />
                    <div className="relative flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <Zap size={14} className={dashReady ? 'text-sky-300' : 'text-slate-500'} />
                        <span className="text-[11px] font-black uppercase tracking-wide text-white">Dash</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-700 text-[9px] font-mono font-bold text-sky-300">
                        {dashReady ? 'SHIFT' : `${battleHud.dashCd.toFixed(1)}s`}
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerNutriPulse();
                    }}
                    disabled={!pulseReady}
                    className={`relative overflow-hidden rounded-xl border px-2.5 py-2 text-left transition-all backdrop-blur-md ${
                      pulseReady
                        ? 'bg-slate-950/85 border-emerald-400/70 hover:border-emerald-300 hover:scale-[1.03] active:scale-95 shadow-[0_0_16px_rgba(74,222,128,0.28)] cursor-pointer'
                        : 'bg-slate-950/70 border-slate-700/70 opacity-80 cursor-not-allowed'
                    }`}
                  >
                    <div
                      className="absolute inset-y-0 left-0 bg-emerald-500/15 transition-[width] duration-75"
                      style={{ width: `${pulseFillPct}%` }}
                    />
                    <div className="relative flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <Sparkles size={14} className={pulseReady ? 'text-emerald-300' : 'text-slate-500'} />
                        <span className="text-[11px] font-black uppercase tracking-wide text-white">Pulse</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-700 text-[9px] font-mono font-bold text-emerald-300">
                        {pulseReady ? 'F' : `${battleHud.pulseCd.toFixed(1)}s`}
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Bottom-Center Nutrition Balance Gauge (when Nutrition Balance modifier is active) */}
              {modifiers.nutritionBalanceMode && (
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-[280px] sm:w-[320px] bg-slate-950/80 backdrop-blur-md border border-slate-700/80 rounded-xl px-3.5 py-2 shadow-xl">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider mb-1">
                    <span className="text-red-400">Junk</span>
                    <span
                      className={
                        Math.abs(battleHud.balanceLevel) < 20
                          ? 'text-emerald-300'
                          : Math.abs(battleHud.balanceLevel) > 80
                            ? 'text-red-300 animate-pulse'
                            : 'text-amber-300'
                      }
                    >
                      {Math.abs(battleHud.balanceLevel) < 20
                        ? 'Balanced (2x DMG)'
                        : Math.abs(battleHud.balanceLevel) > 80
                          ? 'Malnourished!'
                          : 'Unbalanced'}
                    </span>
                    <span className="text-emerald-400">Healthy</span>
                  </div>
                  <div className="relative h-2.5 w-full rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                    <div className="absolute inset-y-0 left-0 w-[20%] bg-red-500/25" />
                    <div className="absolute inset-y-0 left-[40%] w-[20%] bg-emerald-500/25" />
                    <div className="absolute inset-y-0 right-0 w-[20%] bg-sky-500/25" />
                    <div
                      className="absolute top-0 bottom-0 w-1.5 -ml-[3px] bg-white rounded-full shadow-[0_0_8px_#fff]"
                      style={{ left: `${50 + battleHud.balanceLevel / 2}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })()}
        
        {/* UI Overlays */}
        {gameState === 'START' && (
          <div className="absolute inset-0 bg-slate-950/80 overflow-y-auto text-white p-4 sm:p-8 text-center backdrop-blur-sm z-40">
            <div className="fixed top-4 right-4 z-50">
              <button
                onClick={toggleMenuMusic}
                className={`px-3.5 py-2 rounded-xl border text-xs font-bold uppercase tracking-wider flex items-center gap-2.5 backdrop-blur-md shadow-xl transition-all hover:scale-105 ${
                  menuMusicMuted
                    ? 'bg-slate-900/90 border-slate-700 text-slate-400 hover:text-white'
                    : menuMusicActive
                      ? 'bg-slate-900/90 border-amber-400/50 text-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.2)]'
                      : 'bg-amber-500/20 border-amber-400 text-amber-200 animate-pulse'
                }`}
                title={menuMusicMuted ? 'Unmute Menu Music' : 'Mute Menu Music'}
              >
                {menuMusicMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                {!menuMusicMuted && menuMusicActive && (
                  <span className="flex items-end gap-[2px] h-3" aria-hidden="true">
                    <span className="w-[3px] bg-amber-400 rounded-sm animate-[pulse_0.6s_ease-in-out_infinite] h-2" />
                    <span className="w-[3px] bg-amber-300 rounded-sm animate-[pulse_0.45s_ease-in-out_infinite_0.15s] h-3" />
                    <span className="w-[3px] bg-orange-400 rounded-sm animate-[pulse_0.55s_ease-in-out_infinite_0.3s] h-1.5" />
                  </span>
                )}
                <span>
                  {menuMusicMuted
                    ? 'Menu Music: Off'
                    : menuMusicActive
                      ? 'Menu Theme'
                      : 'Enable Menu Music'}
                </span>
              </button>
            </div>
            <div className="min-h-full flex flex-col items-center justify-center py-6 max-w-4xl mx-auto">
              <img src={bossImage.src} className="w-32 h-auto mb-6 drop-shadow-[0_0_30px_rgba(239,68,68,0.6)]" alt="Gorgotolisis" referrerPolicy="no-referrer" />
            <h2 className="text-5xl font-black mb-4 text-white drop-shadow-lg">
              {modifiers.monkCartmanMode ? 'CONFRONT MONK CARTMAN' : 'Gorgotolisis Boss Fight 26'}
            </h2>
            
            {!user ? (
              <div className="mb-8 p-6 bg-slate-900/60 rounded-2xl border border-slate-700">
                <p className="mb-4 text-slate-300">Sign in to save your progress and high scores!</p>
                <button 
                  onClick={handleLogin}
                  className="px-8 py-3 bg-white text-slate-950 font-black rounded-full hover:bg-slate-200 transition-all flex items-center gap-3"
                >
                  <img src="https://www.gstatic.com/firebase/anonymous-scan.png" className="w-6 h-6 hidden" alt="" />
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Sign in with Google
                </button>
              </div>
            ) : (
              <div className="mb-8 flex items-center gap-4 p-4 bg-slate-900/40 rounded-2xl border border-slate-800">
                <img src={user.photoURL || ''} className="w-12 h-12 rounded-full border-2 border-green-500" alt="" />
                <div className="text-left">
                  <div className="text-sm text-slate-400">Logged in as</div>
                  <div className="font-bold text-green-400">{user.displayName}</div>
                  <div className="text-xs text-slate-500">Best: {profile?.highScore || 0} pts</div>
                </div>
                
                {profile?.isVip ? (
                  <div className="ml-4 px-3 py-1 bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 font-bold rounded-lg text-xs shadow-[0_0_15px_rgba(251,191,36,0.3)] border border-yellow-300">
                    👑 GIGA GORG VIP
                  </div>
                ) : (
                  <button 
                    onClick={() => {
                      if (!user) return;
                      setShowVipModal(true);
                    }}
                    className="ml-4 px-3 py-1 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-amber-400 hover:to-orange-500 text-slate-300 hover:text-slate-900 font-bold rounded-lg text-xs transition-all border border-slate-600 hover:border-yellow-300 group shadow-lg"
                  >
                    👑 BUY VIP <span className="text-[10px] opacity-70">($5/mo)</span>
                  </button>
                )}

                <button onClick={() => signOut(auth)} className="ml-2 p-2 text-slate-500 hover:text-red-400"><LogOut size={16} /></button>
              </div>
            )}

            <p className="text-xl text-slate-300 mb-6 max-w-lg leading-relaxed">
              {modifiers.monkCartmanMode 
                ? "The master of focus has challenged you! Monk Cartman is testing your discipline and nutrition. Can you withstand his tranquility and authority?"
                : "The gluttonous demon is attacking with junk food! As he takes damage, his I-Ready Test score rises. Deflect the healthy food to hurt him!"}
            </p>

            <button 
              onClick={() => initGame()}
              className="px-10 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-black text-2xl rounded-full transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(34,197,94,0.4)] mb-8"
            >
              START BATTLE
            </button>

            <div className="flex gap-12 mb-8 text-slate-300">
              <div className="flex flex-col items-center bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                <div className="text-4xl mb-3">⌨️</div>
                <span className="font-bold text-lg">WASD / Arrows</span>
                <span className="text-sm text-slate-400">to Move</span>
              </div>
              <div className="flex flex-col items-center bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                <div className="text-4xl mb-3">🥗</div>
                <span className="font-bold text-lg">Touch the Salad</span>
                <span className="text-sm text-slate-400">to Deflect it back!</span>
              </div>
            </div>

            <div className="flex flex-col gap-4 mb-8 w-full max-w-2xl">
              <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                <div className="flex gap-4">
                  <button 
                    onClick={() => setMenuTab('modifiers')}
                    className={`text-xl font-bold uppercase tracking-widest pb-2 border-b-2 transition-colors ${menuTab === 'modifiers' ? 'text-blue-400 border-blue-400' : 'text-slate-500 border-transparent hover:text-slate-400'}`}
                  >
                    Modifiers
                  </button>
                  <button 
                    onClick={() => setMenuTab('skins')}
                    className={`text-xl font-bold uppercase tracking-widest pb-2 border-b-2 transition-colors flex items-center gap-2 ${menuTab === 'skins' ? 'text-purple-400 border-purple-400' : 'text-slate-500 border-transparent hover:text-slate-400'}`}
                  >
                    Skins Shop
                  </button>
                </div>
                <div className="flex items-center gap-3 bg-yellow-400/10 px-4 py-2 border border-yellow-400/30 rounded-full">
                  <img src="https://media.istockphoto.com/id/135194728/photo/rolling-in-the-money.jpg?s=1024x1024&w=is&k=20&c=Q7-e8Tcu5CV8nUZgAY5BloFUddWqPVvm1kO5hwGzfTA=" alt="Money" className="w-8 h-8 rounded-full object-cover border border-yellow-400/50" referrerPolicy="no-referrer" />
                  <span className="font-bold text-yellow-400 text-lg">{profile?.coins || 0}</span>
                </div>
              </div>

              <div className="h-[400px]">
                {menuTab === 'modifiers' ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-900/80 p-6 rounded-2xl border-2 border-slate-700 shadow-xl h-full overflow-y-auto">
                    {MODIFIER_DEFS.map((mod) => {
                      const cooldownMins = profile?.isVip ? 10 : 15;
                      const isTimeLocked = mod.id === 'aiMode' && profile?.lastAIPlay && (Date.now() - profile.lastAIPlay < cooldownMins * 60 * 1000);
                      const isLocked = isTimeLocked; // All other modifiers are unlocked!
                      return (
                        <button
                          key={mod.id}
                          disabled={isLocked}
                          onClick={() => {
                            setModifiers(prev => ({ ...prev, [mod.id]: !prev[mod.id as keyof Modifiers] }));
                          }}
                          className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all group relative ${
                            isLocked 
                              ? 'bg-slate-900/50 border-slate-800 opacity-50 grayscale cursor-not-allowed'
                              : modifiers[mod.id as keyof Modifiers] 
                                ? 'bg-blue-600/30 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' 
                                : 'bg-slate-800 border-transparent hover:bg-slate-700'
                          }`}
                        >
                          <div className="w-14 h-14 mb-2 overflow-hidden rounded-lg bg-slate-700 flex items-center justify-center border border-slate-600 group-hover:border-slate-400 transition-colors">
                            {isLocked ? (
                              <div className="text-xl">🔒</div>
                            ) : (
                              <img 
                                src={mod.image} 
                                alt={mod.name} 
                                className="w-full h-full object-cover" 
                                referrerPolicy="no-referrer"
                              />
                            )}
                          </div>
                          <span className="font-bold text-[9px] uppercase tracking-tighter text-center leading-none">
                            {isLocked ? 'Locked' : mod.name}
                          </span>
                          
                          {/* Tooltip on hover */}
                          <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-900 border border-slate-700 p-2 rounded text-[10px] w-32 z-50 pointer-events-none shadow-2xl">
                            {isTimeLocked ? `Cooldown active! Wait ${Math.ceil((cooldownMins * 60 * 1000 - (Date.now() - profile.lastAIPlay)) / 60000)}m.` : isLocked ? "Beat the boss to unlock more modifiers!" : mod.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-900/80 p-6 rounded-2xl border-2 border-slate-700 shadow-xl h-full overflow-y-auto">
                    {SHOP_SKINS.map((skin) => {
                      const isVipSkin = skin.id === 'vip_crown';
                      const skinPrice = profile?.isVip ? Math.floor(skin.price * 0.5) : skin.price;
                      const isUnlocked = profile?.unlockedSkins?.includes(skin.id) || skinPrice === 0 || (isVipSkin && profile?.isVip);
                      const isSelected = profile?.selectedSkin === skin.id || (!profile?.selectedSkin && skin.id === '🏃');
                      return (
                        <button
                          key={skin.id}
                          onClick={async () => {
                            if (!user) return alert('Please sign in to save skins!');
                            if (isUnlocked) {
                              await updateDoc(doc(db, 'users', user.uid), { selectedSkin: skin.id });
                              setProfile({ ...profile, selectedSkin: skin.id });
                            } else if (profile?.coins >= skinPrice && !isVipSkin) {
                              await updateDoc(doc(db, 'users', user.uid), { 
                                unlockedSkins: [...(profile.unlockedSkins || []), skin.id],
                                selectedSkin: skin.id,
                                coins: increment(-skinPrice)
                              });
                              setProfile({ 
                                ...profile, 
                                unlockedSkins: [...(profile.unlockedSkins || []), skin.id],
                                selectedSkin: skin.id,
                                coins: profile.coins - skinPrice
                              });
                            } else if (isVipSkin && !profile?.isVip) {
                              setShowVipModal(true);
                            }
                          }}
                          className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all group relative ${
                            isSelected ? 'bg-purple-600/30 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]' 
                            : isUnlocked ? 'bg-slate-800 border-slate-600 hover:bg-slate-700'
                            : (profile && profile.coins >= skinPrice && !isVipSkin) ? 'bg-slate-800 border-green-600/50 hover:bg-green-800/30'
                            : 'bg-slate-900/50 border-slate-800 opacity-70 cursor-not-allowed'
                          }`}
                        >
                          {skin.type === 'image' ? (
                            <img src={skin.value} className="w-12 h-12 object-cover rounded mb-2 border border-slate-700" alt={skin.name} />
                          ) : (
                            <div className="text-4xl mb-2">{skin.value}</div>
                          )}
                          <span className="font-bold text-[11px] uppercase tracking-tighter text-center leading-none mb-2">
                            {skin.name}
                          </span>
                          <span className={`text-[10px] font-bold px-3 py-1 rounded bg-slate-950/80 flex gap-1 items-center ${isUnlocked ? 'text-green-400' : (profile && profile.coins >= skinPrice && !isVipSkin) ? 'text-yellow-400' : 'text-red-400'}`}>
                            {isSelected ? 'SELECTED' : isUnlocked ? 'EQUIP' : (isVipSkin && !profile?.isVip) ? 'VIP EXCLUSIVE' : (
                              <>
                                🪙 {skinPrice} 
                                {profile?.isVip && skin.price > 0 && !isVipSkin && <span className="line-through text-slate-500 text-[8px]">{skin.price}</span>}
                              </>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>
        )}

        {isPaused && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-white p-8 text-center backdrop-blur-md z-50">
            <h2 className="text-6xl font-black mb-8 text-blue-400 drop-shadow-[0_0_20px_rgba(59,130,246,0.5)]">PAUSED</h2>
            <div className="flex flex-col gap-6 w-full max-w-xs">
              <button 
                onClick={() => setIsPaused(false)}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xl rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg"
              >
                RESUME
              </button>
              <button 
                onClick={() => { setGameState('START'); setIsPaused(false); setMusicPlaying(false); }}
                className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xl rounded-xl transition-all hover:scale-105 active:scale-95 border border-slate-600"
              >
                EXIT
              </button>
            </div>
          </div>
        )}

        {showVipModal && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-white p-8 text-center backdrop-blur-md z-50 overflow-y-auto">
            <h2 className="text-5xl font-black mt-8 mb-6 text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.5)] border-b-2 border-amber-400/50 pb-4">👑 GIGA GORG VIP 👑</h2>
            
            <div className="bg-slate-900 border-2 border-yellow-500 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-[0_0_30px_rgba(251,191,36,0.2)] mb-8 text-left space-y-4">
              <p className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-200 to-yellow-500 mb-6 text-center">Unlock Ultimate Power!</p>
              
              <div className="flex gap-4 items-center">
                <span className="text-4xl drop-shadow-md">💰</span>
                <div>
                  <div className="font-bold text-lg text-amber-300">2x Coins Match Bonus</div>
                  <div className="text-sm text-slate-400">Earn double the coins per game!</div>
                </div>
              </div>
              
              <div className="flex gap-4 items-center">
                <span className="text-4xl drop-shadow-md">🛍️</span>
                <div>
                  <div className="font-bold text-lg text-amber-300">50% Off Skins Store</div>
                  <div className="text-sm text-slate-400">Half price on all skins!</div>
                </div>
              </div>

              <div className="flex gap-4 items-center">
                <span className="text-4xl drop-shadow-md">🤖</span>
                <div>
                  <div className="font-bold text-lg text-amber-300">-5 Min AI Cooldown</div>
                  <div className="text-sm text-slate-400">Play the AI Director mode more often!</div>
                </div>
              </div>

              <div className="flex gap-4 items-center">
                <span className="text-4xl drop-shadow-md">❤️</span>
                <div>
                  <div className="font-bold text-lg text-amber-300">+100 Max Health</div>
                  <div className="text-sm text-slate-400">Start every fight with a permanent health boost!</div>
                </div>
              </div>

              <div className="flex gap-4 items-center">
                <span className="text-4xl drop-shadow-md">👑</span>
                <div>
                  <div className="font-bold text-lg text-amber-300">Exclusive Crown Skin</div>
                  <div className="text-sm text-slate-400">Show off your VIP status with a golden crown!</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={() => setShowVipModal(false)}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all border border-slate-600"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  if (!user) return;
                  await updateDoc(doc(db, 'users', user.uid), { isVip: true });
                  setProfile({...profile, isVip: true});
                  setShowVipModal(false);
                }}
                className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-900 font-black rounded-xl transition-all hover:scale-105 shadow-[0_0_20px_rgba(245,158,11,0.5)]"
              >
                SUBSCRIBE NOW - $5/mo
              </button>
            </div>
          </div>
        )}

        {/* Fullscreen Unskippable Video Cutscene */}
        {gameState === 'VIDEO_CINEMATIC' && (
          <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center select-none overflow-hidden">
            <video
              ref={videoCutsceneRef}
              src="https://files.catbox.moe/bzogm1.mp4"
              autoPlay
              playsInline
              controls={false}
              onEnded={() => {
                setGameState('PLAYING');
              }}
              className="w-full h-full object-cover pointer-events-none"
            />

            {/* Z key skip badge */}
            <div className="absolute top-6 right-6 z-[110] opacity-80 hover:opacity-100 transition-opacity">
              <button
                onClick={() => setGameState('PLAYING')}
                className="px-4 py-2 bg-black/70 hover:bg-black/90 text-white font-bold text-xs rounded-full border border-amber-400/60 flex items-center gap-2 uppercase tracking-wider backdrop-blur-md shadow-2xl"
              >
                <span className="px-1.5 py-0.5 bg-amber-400 text-slate-950 font-black rounded text-[10px]">Z</span>
                <span>Skip Video</span>
              </button>
            </div>
          </div>
        )}

        {gameState === 'DIALOGUE' && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-white p-8 text-center backdrop-blur-md z-50">
            {dialogueMode === 'CARTMAN' ? (
              <div className="flex flex-col items-center mb-6">
                <img src={helicopterImage.src} className="w-64 h-auto animate-bounce mb-4" alt="Helicopter" referrerPolicy="no-referrer" />
                <img src={cartmanImage.src} className="w-40 h-auto" alt="Monk Cartman" referrerPolicy="no-referrer" />
              </div>
            ) : (
              <img src={bossImage.src} className="w-32 h-auto mb-6 animate-pulse drop-shadow-[0_0_30px_rgba(239,68,68,0.4)]" alt="Gorgotolisis" referrerPolicy="no-referrer" />
            )}
            <div className="max-w-2xl bg-slate-900 border-2 border-slate-700 p-8 rounded-2xl shadow-2xl">
              <h3 className="text-amber-500 font-black text-2xl mb-4 tracking-widest uppercase">
                {dialogueMode === 'CARTMAN' ? 'Monk Cartman Arrives' : (dialogueMode === 'TWIST' ? 'THE PLOT TWIST' : 'Gorgotolisis Speaks')}
              </h3>
              <p className="text-2xl font-medium leading-relaxed mb-8 min-h-[120px] text-slate-200 italic">
                "{dialogueMode === 'BACKSTORY' ? BACKSTORY_DIALOGUE[dialogueIndex] : 
                  (dialogueMode === 'LIVE_PATH' ? LIVE_PATH_DIALOGUE[dialogueIndex] : 
                  (dialogueMode === 'CARTMAN' ? CARTMAN_DIALOGUE[dialogueIndex] : 
                  (dialogueMode === 'TWIST' ? CINEMATIC_TWIST_DIALOGUE[dialogueIndex] : BACKSTORY_DIALOGUE[dialogueIndex])))}"
              </p>
              
              <div className="flex justify-center gap-6">
                {dialogueMode === 'BACKSTORY' && dialogueIndex === BACKSTORY_DIALOGUE.length - 1 ? (
                  <>
                    <button 
                      onClick={() => {
                        setDialogueMode('LIVE_PATH');
                        setDialogueIndex(0);
                      }}
                      className="px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-black rounded-full transition-all hover:scale-105 shadow-[0_0_20px_rgba(22,163,74,0.4)]"
                    >
                      I CHOOSE TO LIVE
                    </button>
                    <button 
                      onClick={() => {
                        boss.current.corruption = 1000;
                        boss.current.state = 'ULTIMATE_SPAM';
                        setGameState('PLAYING');
                      }}
                      className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-black rounded-full transition-all hover:scale-105 shadow-[0_0_20px_rgba(220,38,38,0.4)]"
                    >
                      I CHOOSE TO DIE
                    </button>
                  </>
                ) : (dialogueMode === 'CARTMAN' && dialogueIndex === CARTMAN_DIALOGUE.length - 1) ? (
                  <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                    <button 
                      onClick={() => {
                        if (modifiers.gorgotastic) return;
                        // Launch Evac Cutscene
                        helicopter.current = {
                          x: player.current.x - 800,
                          y: player.current.y - 600,
                          width: 220,
                          height: 110,
                          active: true,
                          hasPlayer: false,
                          targetX: player.current.x,
                          targetY: player.current.y - 140,
                          speed: 550,
                          rotation: 0,
                          phase: 'APPROACH',
                          cutsceneTimer: 0,
                          ladderLength: 0,
                        };
                        isRescueEnding.current = false;
                        setGameState('PLAYING');
                      }}
                      className="px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xl rounded-full transition-all hover:scale-105 shadow-[0_0_25px_rgba(245,158,11,0.6)] flex items-center gap-2"
                    >
                      <span>🚁</span> Get in the heli?
                    </button>
                    <button 
                      onClick={() => {
                        // Refuse chopper - Stay & fight on foot
                        helicopter.current.active = false;
                        setGameState('PLAYING');
                      }}
                      className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-black text-xl rounded-full transition-all hover:scale-105 border border-slate-600 flex items-center gap-2"
                    >
                      <span>⚔️</span> Stay & Fight on Foot
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => {
                      const currentLines = dialogueMode === 'BACKSTORY' ? BACKSTORY_DIALOGUE : 
                                          (dialogueMode === 'LIVE_PATH' ? LIVE_PATH_DIALOGUE : 
                                          (dialogueMode === 'CARTMAN' ? CARTMAN_DIALOGUE : 
                                          (dialogueMode === 'SALAD_DISGUSTING' ? SALAD_DISGUSTING_DIALOGUE : 
                                          (dialogueMode === 'MONK_BOSS' ? MONK_BOSS_DIALOGUE :
                                          (dialogueMode === 'TWIST' ? CINEMATIC_TWIST_DIALOGUE : BACKSTORY_DIALOGUE)))));
                      if (dialogueIndex < currentLines.length - 1) {
                        setDialogueIndex(dialogueIndex + 1);
                      } else {
                        if (dialogueMode === 'MONK_BOSS') {
                          setGameState('PLAYING');
                          return;
                        }
                        if (dialogueMode === 'SALAD_DISGUSTING' && !modifiers.gorgotastic) {
                          helicopter.current = {
                            x: player.current.x - 800,
                            y: player.current.y - 600,
                            width: 220,
                            height: 110,
                            active: true,
                            hasPlayer: false,
                            targetX: player.current.x,
                            targetY: player.current.y - 140,
                            speed: 550,
                            rotation: 0,
                            phase: 'APPROACH',
                            cutsceneTimer: 0,
                            ladderLength: 0,
                          };
                          isRescueEnding.current = false;
                        }
                        if (dialogueMode === 'TWIST') {
                          boss.current.corruption = 900;
                          boss.current.width *= 1.5;
                          boss.current.height *= 1.5;
                          boss.current.state = 'SMASH_2';
                        }
                        setGameState('PLAYING');
                      }
                    }}
                    className="px-10 py-4 bg-slate-700 hover:bg-slate-600 text-white font-black rounded-full transition-all hover:scale-105"
                  >
                    CONTINUE...
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {gameState === 'PLAYING' && modifiers.mobile && !isDeathCutscene && !isPhase2Cutscene && !isPhase3Cutscene && !isEntranceCutscene && (
          <div className="absolute bottom-8 left-8 flex flex-col gap-4 z-40">
            <div className="grid grid-cols-3 gap-2">
              <div />
              <button 
                onMouseDown={() => { keys.current['w'] = true; }}
                onMouseUp={() => { keys.current['w'] = false; }}
                onTouchStart={() => { keys.current['w'] = true; }}
                onTouchEnd={() => { keys.current['w'] = false; }}
                className="w-16 h-16 bg-slate-800/80 border-2 border-slate-600 rounded-xl flex items-center justify-center text-2xl active:bg-slate-600 active:scale-95 transition-all"
              >
                ↑
              </button>
              <div />
              <button 
                onMouseDown={() => { keys.current['a'] = true; }}
                onMouseUp={() => { keys.current['a'] = false; }}
                onTouchStart={() => { keys.current['a'] = true; }}
                onTouchEnd={() => { keys.current['a'] = false; }}
                className="w-16 h-16 bg-slate-800/80 border-2 border-slate-600 rounded-xl flex items-center justify-center text-2xl active:bg-slate-600 active:scale-95 transition-all"
              >
                ←
              </button>
              <button 
                onMouseDown={() => { keys.current['s'] = true; }}
                onMouseUp={() => { keys.current['s'] = false; }}
                onTouchStart={() => { keys.current['s'] = true; }}
                onTouchEnd={() => { keys.current['s'] = false; }}
                className="w-16 h-16 bg-slate-800/80 border-2 border-slate-600 rounded-xl flex items-center justify-center text-2xl active:bg-slate-600 active:scale-95 transition-all"
              >
                ↓
              </button>
              <button 
                onMouseDown={() => { keys.current['d'] = true; }}
                onMouseUp={() => { keys.current['d'] = false; }}
                onTouchStart={() => { keys.current['d'] = true; }}
                onTouchEnd={() => { keys.current['d'] = false; }}
                className="w-16 h-16 bg-slate-800/80 border-2 border-slate-600 rounded-xl flex items-center justify-center text-2xl active:bg-slate-600 active:scale-95 transition-all"
              >
                →
              </button>
            </div>
          </div>
        )}

        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 bg-red-950/90 flex flex-col items-center justify-center text-white backdrop-blur-md px-6 text-center">
            <div className="text-8xl mb-6">{deathCause === 'CHOLESTEROL_BEAM' ? '💥' : '💀'}</div>
            <h2 className="text-5xl md:text-6xl font-black mb-4 text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]">
              {deathCause === 'CHOLESTEROL_BEAM' ? 'HELICOPTER OBLITERATED!' : 'DEFEATED'}
            </h2>
            <p className="text-xl md:text-2xl mb-10 text-red-200 font-medium max-w-xl">
              {deathCause === 'CHOLESTEROL_BEAM'
                ? 'Gorgotolisis reawakened and blasted the rescue helicopter with a lethal 10,000,000-calorie Beam of Pure Cholesterol & Calories, vaporizing it in mid-air!'
                : 'You succumbed to the junk food...'}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button 
                onClick={initGame}
                className="px-10 py-4 bg-red-600 hover:bg-red-500 text-white font-black text-xl rounded-full transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(220,38,38,0.5)] flex items-center gap-2"
              >
                <span>🔄</span> TRY AGAIN
              </button>
              <button 
                onClick={() => {
                  if (document.pointerLockElement) {
                    document.exitPointerLock?.();
                  }
                  if (audioRef.current) {
                    audioRef.current.pause();
                  }
                  setMusicPlaying(false);
                  setIsPaused(false);
                  setGameState('START');
                }}
                className="px-10 py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-black text-xl rounded-full transition-all hover:scale-105 active:scale-95 border border-slate-600 shadow-xl flex items-center gap-2"
              >
                <span>🏠</span> MAIN MENU
              </button>
            </div>
          </div>
        )}

        {gameState === 'VICTORY' && (
          <div className="absolute inset-0 bg-green-950/90 flex flex-col items-center justify-center text-white backdrop-blur-md">
            <div className="text-8xl mb-6">🏆</div>
            <h2 className="text-6xl font-black mb-4 text-green-400 drop-shadow-[0_0_20px_rgba(74,222,128,0.8)]">VICTORY!</h2>
            <p className="text-2xl mb-10 text-green-200 font-medium max-w-lg text-center">
              You defeated {modifiers.monkCartmanMode ? 'Monk Cartman' : 'Gorgotolisis'} with the power of nutrition!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button 
                onClick={initGame}
                className="px-10 py-4 bg-green-500 hover:bg-green-400 text-slate-950 font-black text-xl rounded-full transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(34,197,94,0.5)] flex items-center gap-2"
              >
                <span>🔄</span> PLAY AGAIN
              </button>
              <button 
                onClick={() => {
                  if (document.pointerLockElement) {
                    document.exitPointerLock?.();
                  }
                  if (audioRef.current) {
                    audioRef.current.pause();
                  }
                  setMusicPlaying(false);
                  setIsPaused(false);
                  setGameState('START');
                }}
                className="px-10 py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-black text-xl rounded-full transition-all hover:scale-105 active:scale-95 border border-slate-600 shadow-xl flex items-center gap-2"
              >
                <span>🏠</span> MAIN MENU
              </button>
            </div>
          </div>
        )}

        {/* Admin Panel Toggle Button */}
        {isGodModeActive && gameState === 'PLAYING' && !isDeathCutscene && !isPhase2Cutscene && !isPhase3Cutscene && !isEntranceCutscene && (
          <button 
            onClick={() => {
              setShowAdminPanel(!showAdminPanel);
              setAdminCorruption(boss.current.corruption);
            }}
            className="absolute top-4 left-4 z-50 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg shadow-lg transition-all"
          >
            {showAdminPanel ? 'CLOSE ADMIN' : 'OPEN ADMIN'}
          </button>
        )}

        {/* Admin Panel Overlay */}
        {showAdminPanel && isGodModeActive && !isDeathCutscene && !isPhase2Cutscene && !isPhase3Cutscene && !isEntranceCutscene && (
          <div className="absolute inset-0 z-40 bg-slate-950/90 backdrop-blur-md p-6 overflow-y-auto text-white">
            <h2 className="text-3xl font-black mb-6 text-amber-500 flex items-center gap-3">
              <span>🛠️</span> ADMIN CONTROL PANEL
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* I-Ready Test Control */}
              <div className="bg-slate-900 p-5 rounded-xl border border-slate-700">
                <h3 className="text-xl font-bold mb-4 text-slate-300">I-Ready Test Level</h3>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" 
                    min="0" 
                    max="1000" 
                    value={adminCorruption}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setAdminCorruption(val);
                      boss.current.corruption = val;
                      boss.current.regenRate = 15 + (val / 5);
                    }}
                    className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <span className="text-2xl font-mono font-bold text-amber-500 w-20 text-right">{adminCorruption}%</span>
                </div>
                <div className="flex gap-2 mt-4">
                  {[0, 250, 500, 750, 1000].map(val => (
                    <button 
                      key={val}
                      onClick={() => {
                        setAdminCorruption(val);
                        boss.current.corruption = val;
                        boss.current.regenRate = 15 + (val / 5);
                      }}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs font-bold"
                    >
                      {val}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Boss Controls */}
              <div className="bg-slate-900 p-5 rounded-xl border border-slate-700">
                <h3 className="text-xl font-bold mb-4 text-slate-300">Boss Management</h3>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-400 mb-2">Regen Rate: {Math.floor(boss.current.regenRate)} HP/s</label>
                  <input 
                    type="range" min="0" max="500" step="5"
                    defaultValue={boss.current.regenRate}
                    onChange={(e) => { boss.current.regenRate = parseInt(e.target.value); }}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <button 
                    onClick={(e) => {
                      isControllingBoss.current = !isControllingBoss.current;
                      (e.target as HTMLButtonElement).innerText = isControllingBoss.current ? 'BECOME PLAYER' : 'BECOME BOSS';
                    }}
                    className={`px-4 py-2 ${isControllingBoss.current ? 'bg-orange-600' : 'bg-slate-600'} rounded-lg font-bold transition-colors`}
                  >
                    {isControllingBoss.current ? 'BECOME PLAYER' : 'BECOME BOSS'}
                  </button>
                  <button 
                    onClick={() => { boss.current.health = 0; }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-bold transition-colors"
                  >
                    INSTANT KILL
                  </button>
                  <button 
                    onClick={() => { boss.current.health = boss.current.maxHealth; }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-colors"
                  >
                    FULL HEAL
                  </button>
                  <button 
                    onClick={(e) => {
                      isBossFrozen.current = !isBossFrozen.current;
                      (e.target as HTMLButtonElement).innerText = isBossFrozen.current ? 'UNFREEZE BOSS' : 'FREEZE BOSS';
                    }}
                    className={`px-4 py-2 ${isBossFrozen.current ? 'bg-cyan-600' : 'bg-slate-600'} rounded-lg font-bold transition-colors`}
                  >
                    {isBossFrozen.current ? 'UNFREEZE BOSS' : 'FREEZE BOSS'}
                  </button>
                  <button 
                    onClick={() => {
                      const states: Boss['state'][] = ['NORMAL', 'SLAMMING', 'SUMMON_GUY', 'SUMMONING_DONGFISH', 'OREO_SANDWICH', 'CHEF_SPIN', 'OATMEAL_WALL', 'ULTIMATE_SPAM', 'CHERRY_CHARGE', 'DIZZY', 'RAGE', 'WHEELCHAIR', 'SMASH_2', 'SODA_BLAST', 'EARTHQUAKE_CRACK'];
                      const next = states[(states.indexOf(boss.current.state) + 1) % states.length];
                      boss.current.state = next;
                      boss.current.slamTimer = 5;
                      if (next === 'SLAMMING') {
                        const { height: CANVAS_HEIGHT } = dimensionsRef.current;
                        const cameraY = Math.max(0, Math.min(WORLD_HEIGHT - CANVAS_HEIGHT, player.current.y - CANVAS_HEIGHT / 2));
                        boss.current.x = player.current.x;
                        boss.current.y = cameraY - boss.current.height - 40;
                      }
                    }}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg font-bold transition-colors"
                  >
                    NEXT STATE: {boss.current.state}
                  </button>
                </div>
              </div>

              {/* Player Controls */}
              <div className="bg-slate-900 p-5 rounded-xl border border-slate-700">
                <h3 className="text-xl font-bold mb-4 text-slate-300">Player Management</h3>
                <div className="flex flex-wrap gap-3">
                  <button 
                    onClick={() => { player.current.health = player.current.maxHealth; }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-bold transition-colors"
                  >
                    FULL HEAL
                  </button>
                  <button 
                    onClick={(e) => {
                      infiniteHealth.current = !infiniteHealth.current;
                      (e.target as HTMLButtonElement).innerText = infiniteHealth.current ? 'DISABLE INF HEALTH' : 'ENABLE INF HEALTH';
                    }}
                    className={`px-4 py-2 ${infiniteHealth.current ? 'bg-emerald-600' : 'bg-slate-600'} rounded-lg font-bold transition-colors`}
                  >
                    {infiniteHealth.current ? 'DISABLE INF HEALTH' : 'ENABLE INF HEALTH'}
                  </button>
                  <button 
                    onClick={() => { player.current.speed = player.current.speed === 350 ? 700 : 350; }}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded-lg font-bold transition-colors"
                  >
                    {player.current.speed > 350 ? 'NORMAL SPEED' : 'SUPER SPEED'}
                  </button>
                </div>
              </div>

              {/* Utility Controls */}
              <div className="bg-slate-900 p-5 rounded-xl border border-slate-700">
                <h3 className="text-xl font-bold mb-4 text-slate-300">Utilities</h3>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-400 mb-2">Projectile Speed Multiplier: {projectileSpeedMult.current}x</label>
                  <input 
                    type="range" min="0.1" max="5" step="0.1"
                    defaultValue={projectileSpeedMult.current}
                    onChange={(e) => { projectileSpeedMult.current = parseFloat(e.target.value); }}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <button 
                    onClick={() => { projectiles.current = []; }}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold transition-colors"
                  >
                    CLEAR PROJECTILES
                  </button>
                  <button 
                    onClick={() => {
                      projectiles.current.push({
                        x: player.current.x,
                        y: player.current.y - 100,
                        vx: 0,
                        vy: 0,
                        radius: 20,
                        emoji: '🩹',
                        isPlayer: false,
                        isHealthy: false,
                        isBandAid: true,
                        rotation: 0,
                        rotationSpeed: 0,
                      });
                    }}
                    className="px-4 py-2 bg-pink-600 hover:bg-pink-500 rounded-lg font-bold transition-colors"
                  >
                    SPAWN BAND-AID
                  </button>
                  <button 
                    onClick={() => {
                      projectiles.current.push({
                        x: player.current.x,
                        y: player.current.y - 100,
                        vx: 0,
                        vy: 0,
                        radius: 20,
                        emoji: HEALTHY_FOODS[Math.floor(Math.random() * HEALTHY_FOODS.length)],
                        isPlayer: false,
                        isHealthy: true,
                        rotation: 0,
                        rotationSpeed: 0,
                      });
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-bold transition-colors"
                  >
                    SPAWN SALAD
                  </button>
                  <button 
                    onClick={() => {
                      setShowAdminPanel(false);
                      helicopter.current = {
                        active: true,
                        hasPlayer: true,
                        targetX: boss.current.x,
                        targetY: boss.current.y - 240,
                        speed: 400,
                        rotation: 0,
                        phase: 'ESCAPE',
                        cutsceneTimer: 0,
                        ladderLength: 115,
                        isAmbushed: Math.random() < 0.20,
                        crashTimer: 0,
                        x: player.current.x,
                        y: player.current.y - 140,
                        width: 180,
                        height: 90
                      };
                      boss.current.health = 0;
                    }}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg font-bold transition-colors"
                  >
                    TEST RESCUE ESCAPE (20% BEAM)
                  </button>
                  <button 
                    onClick={() => {
                      setShowAdminPanel(false);
                      helicopter.current = {
                        active: true,
                        hasPlayer: true,
                        targetX: boss.current.x,
                        targetY: boss.current.y - 240,
                        speed: 400,
                        rotation: 0,
                        phase: 'ESCAPE',
                        cutsceneTimer: 0,
                        ladderLength: 115,
                        isAmbushed: true,
                        crashTimer: 0,
                        x: player.current.x,
                        y: player.current.y - 140,
                        width: 180,
                        height: 90
                      };
                      boss.current.health = 0;
                      boss.current.state = 'RAGE';
                    }}
                    className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg font-bold transition-colors"
                  >
                    FORCE BEAM CRASH (100%)
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800 text-center">
              <button 
                onClick={() => setShowAdminPanel(false)}
                className="px-8 py-3 bg-slate-800 hover:bg-slate-700 rounded-full font-black text-lg transition-all"
              >
                BACK TO GAME
              </button>
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-6 text-slate-500 text-sm font-medium">
        Use WASD to move. Touch healthy food to deflect it.
      </div>
    </div>
  );
}

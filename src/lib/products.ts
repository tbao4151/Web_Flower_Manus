import type { AvailabilityStatus, SaleMode } from "@/lib/inventory";

export type ProductType = string;

export type ProductImageCrop = {
  cropX: number;
  cropY: number;
  cropZoom: number;
  focalX: number;
  focalY: number;
};

export type ProductImage = ProductImageCrop & {
  id?: string;
  src: string;
  alt?: string;
};

export const defaultProductImageCrop: ProductImageCrop = {
  cropX: 0.5,
  cropY: 0.5,
  cropZoom: 1,
  focalX: 0.5,
  focalY: 0.5,
};

export type Product = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  type: ProductType;
  price: number;
  salePrice?: number;
  description?: string;
  composition?: string;
  image: string;
  imageCrop?: ProductImageCrop;
  imageItems?: ProductImage[];
  gallery: string[];
  categories: string[];
  tones: string[];
  occasions: string[];
  featured?: boolean;
  featuredPosition?: 1 | 2 | 3;
  status: "published" | "hidden" | "archived";
  availabilityStatus?: AvailabilityStatus;
  availableQuantity?: number;
  inventoryConfigured?: boolean;
  saleMode?: SaleMode;
  preorderMinHours?: number;
  showWhenOutOfStock?: boolean;
  sourceCaption: string;
  sourceReference: string;
  sourceDate: string;
};

const instagram = "https://www.instagram.com";

export const products: Product[] = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    sku: "IG-LAM-TINH-400",
    slug: "lam-tinh",
    name: "Lam tinh",
    type: "bouquet",
    price: 400000,
    image: "/ig-assets/lam-tinh.jpg",
    gallery: [],
    categories: ["Hoa ly", "Xanh"],
    tones: [],
    occasions: [],
    featured: true,
    status: "published",
    sourceCaption: "Lam tinh\n400🐡",
    sourceReference: `${instagram}/p/DbqTJdTFGng/`,
    sourceDate: "2026-08-05",
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    sku: "IG-GARDEN-380",
    slug: "garden",
    name: "Garden",
    type: "bouquet",
    price: 380000,
    description: "Màu hoa ly có thể đậm, nhạt khác nhau tuỳ đợt hoa.",
    image: "/ig-assets/garden.jpg",
    gallery: [],
    categories: ["Hoa ly"],
    tones: [],
    occasions: [],
    featured: true,
    status: "published",
    sourceCaption: "Garden 🧚🏻‍♀️\n380🐡\nMàu hoa ly có thể đậm, nhạt khác nhau tuỳ đợt hoa",
    sourceReference: `${instagram}/p/Dbc8oEKFCO4/`,
    sourceDate: "2026-07-31",
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    sku: "IG-HOA-LY-350",
    slug: "hoa-ly",
    name: "Hoa ly",
    type: "bouquet",
    price: 350000,
    description: "Màu hoa ly có thể đậm, nhạt khác nhau tuỳ đợt hoa.",
    image: "/ig-assets/hoa-ly.jpg",
    gallery: [],
    categories: ["Hoa ly"],
    tones: [],
    occasions: [],
    featured: true,
    status: "published",
    sourceCaption: "Hoa ly 🩷🎀🦩🩰\n350🐡\nMàu hoa ly có thể đậm, nhạt khác nhau tuỳ đợt hoa",
    sourceReference: `${instagram}/p/Dbc8XX0lAL4/`,
    sourceDate: "2026-07-31",
  },
  {
    id: "20000000-0000-4000-8000-000000000004",
    sku: "IG-LY-XANH-370",
    slug: "ly-xanh",
    name: "Ly xanh",
    type: "bouquet",
    price: 370000,
    description: "Bó sẽ có 3–5 bông ly phụ thuộc kích thước hoa.",
    image: "/ig-assets/ly-xanh.jpg",
    gallery: [],
    categories: ["Hoa ly", "Xanh"],
    tones: [],
    occasions: [],
    featured: true,
    status: "published",
    sourceCaption: "🩵🦋🐬🐳🫐\nBó sẽ có 3-5 bông ly phụ thuộc kích thước hoa\n370🐡",
    sourceReference: `${instagram}/p/Dbc8GJXFHc0/`,
    sourceDate: "2026-07-31",
  },
  {
    id: "20000000-0000-4000-8000-000000000005",
    sku: "IG-LILY-310",
    slug: "lily",
    name: "Lily",
    type: "bouquet",
    price: 310000,
    image: "/ig-assets/lily.jpg",
    gallery: [],
    categories: ["Lily", "Xanh"],
    tones: [],
    occasions: [],
    featured: false,
    status: "published",
    sourceCaption: "Lily 🦋🐬🫐🧵🩵\n310🐡",
    sourceReference: `${instagram}/p/DbSElLSAcaH/`,
    sourceDate: "2026-07-27",
  },
  {
    id: "20000000-0000-4000-8000-000000000006",
    sku: "IG-MOT-BO-HOA-390",
    slug: "mot-bo-hoa-mot-lan-duoc-nho-den",
    name: "Một bó hoa, một lần được nhớ đến",
    type: "bouquet",
    price: 390000,
    image: "/ig-assets/mot-bo-hoa.jpg",
    gallery: [],
    categories: ["Hoa hồng"],
    tones: [],
    occasions: [],
    featured: false,
    status: "published",
    sourceCaption: "Một bó hoa, một lần được nhớ đến♥️🌹🍷🍒\n390🐡",
    sourceReference: `${instagram}/p/DbKpmHKgcHb/`,
    sourceDate: "2026-07-24",
  },
  {
    id: "20000000-0000-4000-8000-000000000007",
    sku: "IG-CAM-TU-CAU-450",
    slug: "cam-tu-cau",
    name: "Cẩm tú cầu",
    type: "bouquet",
    price: 450000,
    image: "/ig-assets/cam-tu-cau.jpg",
    gallery: [],
    categories: ["Cẩm tú cầu", "Xanh"],
    tones: [],
    occasions: [],
    featured: false,
    status: "published",
    sourceCaption: "Cẩm tú cầu 💚\n450🐡",
    sourceReference: `${instagram}/p/DbKovTNgadK/`,
    sourceDate: "2026-07-24",
  },
  {
    id: "20000000-0000-4000-8000-000000000008",
    sku: "IG-PHI-YEN-370",
    slug: "phi-yen",
    name: "Phi yến",
    type: "bouquet",
    price: 370000,
    image: "/ig-assets/phi-yen.jpg",
    gallery: [],
    categories: ["Phi yến"],
    tones: [],
    occasions: [],
    featured: false,
    status: "published",
    sourceCaption: "Phi yến 💜\n370🐡",
    sourceReference: `${instagram}/p/DbFXU4-AZDP/`,
    sourceDate: "2026-07-22",
  },
  {
    id: "20000000-0000-4000-8000-000000000009",
    sku: "IG-SON-SAC-290",
    slug: "son-sac-thuy-chung",
    name: "Son sắc thuỷ chung",
    type: "bouquet",
    price: 290000,
    image: "/ig-assets/son-sac-thuy-chung.jpg",
    gallery: [],
    categories: ["Hoa hồng"],
    tones: [],
    occasions: [],
    featured: false,
    status: "published",
    sourceCaption: "💜Son sắc thuỷ chung💜\n290🐡",
    sourceReference: `${instagram}/p/DbFXEtMgXYe/`,
    sourceDate: "2026-07-22",
  },
];

export const formatVnd = (amount: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount);

export const allTones = Array.from(new Set(products.flatMap((product) => product.tones))).sort();
export const allOccasions = Array.from(new Set(products.flatMap((product) => product.occasions))).sort();
export const allCategories = Array.from(new Set(products.flatMap((product) => product.categories))).sort();

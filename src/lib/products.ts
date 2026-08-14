export type ProductType = "bouquet" | "basket";

export type Product = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  type: ProductType;
  price: number;
  salePrice?: number;
  description: string;
  composition?: string;
  image: string;
  gallery: string[];
  categories: string[];
  tones: string[];
  occasions: string[];
  featured?: boolean;
  status: "published" | "hidden" | "archived";
};

export const products: Product[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    sku: "BO-HONG-001",
    slug: "ru-ngay-hong-phap",
    name: "Rù Ngày Hồng Pháp",
    type: "bouquet",
    price: 650000,
    description: "Một bó hồng Pháp mềm mại, gói trong giấy kem và điểm chút lá xanh cho những lời thương thật dịu.",
    composition: "Hồng Pháp, cúc tana, eucalyptus",
    image: "https://images.unsplash.com/photo-1548586196-5e86b9b5e3d6?auto=format&fit=crop&w=900&q=85",
    gallery: ["https://images.unsplash.com/photo-1520763185298-1b434c919102?auto=format&fit=crop&w=900&q=85"],
    categories: ["Hồng", "Tươi mới"],
    tones: ["Hồng", "Kem"],
    occasions: ["Sinh nhật", "Kỷ niệm"],
    featured: true,
    status: "published",
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    sku: "BO-TULIP-002",
    slug: "mot-chut-binh-yen",
    name: "Một Chút Bình Yên",
    type: "bouquet",
    price: 890000,
    description: "Tulip trắng và cúc mẫu đơn tạo nên một khoảng thở trong trẻo, dành tặng người cần được vỗ về.",
    composition: "Tulip trắng, cúc mẫu đơn, salem",
    image: "https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=900&q=85",
    gallery: ["https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=900&q=85"],
    categories: ["Tulip", "Tối giản"],
    tones: ["Trắng", "Xanh"],
    occasions: ["Chúc mừng", "Sinh nhật"],
    featured: true,
    status: "published",
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    sku: "GIO-MIX-003",
    slug: "vuon-nho-mua-he",
    name: "Vườn Nhỏ Mùa Hè",
    type: "basket",
    price: 1200000,
    description: "Giỏ hoa rực rỡ như một khu vườn nhỏ, đầy năng lượng để gửi lời chúc mừng đến người bạn yêu quý.",
    composition: "Hồng cam, cẩm tú cầu, đồng tiền, lá bạc",
    image: "https://images.unsplash.com/photo-1563241527-3004b7be0ffd?auto=format&fit=crop&w=900&q=85",
    gallery: ["https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=900&q=85"],
    categories: ["Nhiệt đới", "Rực rỡ"],
    tones: ["Cam", "Vàng", "Hồng"],
    occasions: ["Chúc mừng", "Khai trương"],
    featured: true,
    status: "published",
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    sku: "BO-PASTEL-004",
    slug: "loi-thuong-ngot-ngao",
    name: "Lời Thương Ngọt Ngào",
    type: "bouquet",
    price: 540000,
    salePrice: 490000,
    description: "Sắc pastel nhẹ như một tin nhắn nhớ thương, vừa đủ xinh để làm ngày thường trở nên đặc biệt.",
    composition: "Hồng pastel, cát tường, baby trắng",
    image: "https://images.unsplash.com/photo-1494625927555-6ec4433b1571?auto=format&fit=crop&w=900&q=85",
    gallery: ["https://images.unsplash.com/photo-1522057384400-681b421cfebc?auto=format&fit=crop&w=900&q=85"],
    categories: ["Pastel", "Hồng"],
    tones: ["Hồng", "Trắng"],
    occasions: ["Kỷ niệm", "Tỏ tình"],
    featured: false,
    status: "published",
  },
  {
    id: "10000000-0000-4000-8000-000000000005",
    sku: "GIO-HYDR-005",
    slug: "mot-ngay-trong-xanh",
    name: "Một Ngày Trong Xanh",
    type: "basket",
    price: 780000,
    description: "Giỏ hoa xanh trắng thanh mát, phù hợp để chúc ai đó một khởi đầu thật nhiều hy vọng.",
    composition: "Cẩm tú cầu xanh, hồng trắng, thanh liễu",
    image: "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=900&q=85",
    gallery: ["https://images.unsplash.com/photo-1508610048659-a06b669e3321?auto=format&fit=crop&w=900&q=85"],
    categories: ["Tối giản", "Thanh lịch"],
    tones: ["Xanh", "Trắng"],
    occasions: ["Chúc mừng", "Cảm ơn"],
    featured: false,
    status: "published",
  },
  {
    id: "10000000-0000-4000-8000-000000000006",
    sku: "BO-DAU-006",
    slug: "thuong-em-that-nhieu",
    name: "Thương Em Thật Nhiều",
    type: "bouquet",
    price: 980000,
    description: "Một bó hoa đỏ hồng giàu cảm xúc, gửi thay những điều đôi khi mình ngại nói thành lời.",
    composition: "Hồng đỏ, hồng nhạt, lan tường",
    image: "https://images.unsplash.com/photo-1487070183336-b863922373d4?auto=format&fit=crop&w=900&q=85",
    gallery: ["https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=900&q=85"],
    categories: ["Hồng", "Lãng mạn"],
    tones: ["Đỏ", "Hồng"],
    occasions: ["Tỏ tình", "Kỷ niệm"],
    featured: false,
    status: "published",
  },
  {
    id: "10000000-0000-4000-8000-000000000007",
    sku: "GIO-SUN-007",
    slug: "nang-len-nhe",
    name: "Nắng Lên Nhé",
    type: "basket",
    price: 720000,
    description: "Một giỏ hoa vàng kem tươi sáng, như lời nhắc rằng phía trước luôn có những ngày thật đẹp.",
    composition: "Hướng dương, hồng kem, cúc ping pong",
    image: "https://images.unsplash.com/photo-1508610048659-a06b669e3321?auto=format&fit=crop&w=900&q=85",
    gallery: ["https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=900&q=85"],
    categories: ["Rực rỡ", "Tươi mới"],
    tones: ["Vàng", "Kem"],
    occasions: ["Sinh nhật", "Cảm ơn"],
    featured: false,
    status: "published",
  },
  {
    id: "10000000-0000-4000-8000-000000000008",
    sku: "BO-WILD-008",
    slug: "cham-mot-nhip-tho",
    name: "Chậm Một Nhịp Thở",
    type: "bouquet",
    price: 450000,
    description: "Bó hoa dáng tự nhiên cho những ngày cần sống chậm lại, nhìn ngắm và yêu thương nhiều hơn.",
    composition: "Cúc tana, cẩm chướng kem, lá bạc",
    image: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=900&q=85",
    gallery: ["https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=900&q=85"],
    categories: ["Tối giản", "Tươi mới"],
    tones: ["Kem", "Trắng", "Xanh"],
    occasions: ["Cảm ơn", "Sinh nhật"],
    featured: false,
    status: "published",
  },
];

export const formatVnd = (amount: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount);

export const allTones = ["Hồng", "Đỏ", "Trắng", "Cam", "Vàng", "Xanh", "Kem"];
export const allOccasions = ["Sinh nhật", "Kỷ niệm", "Chúc mừng", "Tỏ tình", "Khai trương", "Cảm ơn"];
export const allCategories = ["Hồng", "Tulip", "Pastel", "Tối giản", "Tươi mới", "Rực rỡ", "Lãng mạn", "Thanh lịch", "Nhiệt đới"];

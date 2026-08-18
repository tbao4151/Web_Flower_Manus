import InventoryManager from "../_components/InventoryManager";

export default function AccessoryInventoryPage() {
  return <InventoryManager inventoryType="accessory" title="Kho phụ kiện" itemLabel="Phụ kiện" description="Quản lý giấy gói, ruy băng, nơ, túi, thiệp, giỏ, xốp, lưới, dây, hộp và các phụ kiện khác với cùng quy trình CRUD, tồn kho và audit transaction." badgeClassName="bg-[#f8e5ed] text-[#8d4962]" />;
}

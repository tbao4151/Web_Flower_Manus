import InventoryManager from "../_components/InventoryManager";

export default function FlowerInventoryPage() {
  return <InventoryManager inventoryType="flower" title="Kho hoa" itemLabel="Nguyên liệu" description="Theo dõi hoa và nguyên liệu, tồn khả dụng, trạng thái sắp hết và lịch sử nhập, xuất, hư hao hoặc điều chỉnh. Dữ liệu Kho Hoa dùng chung bảng inventory với discriminator flower." badgeClassName="bg-[#e4ecdf] text-primary" />;
}

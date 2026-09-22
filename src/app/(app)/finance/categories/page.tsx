import type { Metadata } from "next";
import { Page } from "@/components/layout/page";
import { withTenant } from "@/db";
import { requireModule } from "@/lib/auth/dal";
import { CategoryBoard } from "@/modules/finance/components/category-board";
import { listCategories } from "@/modules/finance/queries";

export const metadata: Metadata = { title: "Danh mục" };

export default async function CategoriesPage() {
  const user = await requireModule("finance");
  const categories = await withTenant(user.id, (tx) => listCategories(tx, user.id, { includeArchived: true }));
  return (
    <Page title="Danh mục" description="Đặt tên, màu và biểu tượng cho các khoản thu chi của bạn.">
      <CategoryBoard categories={categories} />
    </Page>
  );
}

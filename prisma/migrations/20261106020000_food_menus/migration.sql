CREATE TABLE "FoodMenu" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FoodMenu_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MenuItem" ADD COLUMN "menuId" TEXT,
ADD COLUMN "available" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "FoodPoll" ADD COLUMN "menuId" TEXT,
ADD COLUMN "price" DECIMAL(10,2);

CREATE INDEX "FoodMenu_restaurantId_idx" ON "FoodMenu"("restaurantId");
CREATE INDEX "MenuItem_menuId_idx" ON "MenuItem"("menuId");
CREATE INDEX "FoodPoll_menuId_idx" ON "FoodPoll"("menuId");

ALTER TABLE "FoodMenu" ADD CONSTRAINT "FoodMenu_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "FoodMenu"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FoodPoll" ADD CONSTRAINT "FoodPoll_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "FoodMenu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

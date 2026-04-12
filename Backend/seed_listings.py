from __future__ import annotations

import argparse
import random
import sys
from decimal import Decimal
from pathlib import Path
from typing import List

SRC_DIR = Path(__file__).resolve().parent / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from create_app import create_app
from infrastructure.databases import SessionLocal
from infrastructure.models.auth.user_model import UserModel
from infrastructure.models.sell.models import Listing, Bicycle, Media

BRANDS = [
    "Trek",
    "Specialized",
    "Giant",
    "Cannondale",
    "Bianchi",
    "Scott",
    "Canyon",
    "Merida",
    "Cervelo",
    "Pinarello",
]

MODEL_SUFFIXES = [
    "Marlin", "Roubaix", "TCR", "Synapse", "Oltre", "Addict", "Propel", "Defy", "Scultura", "Dogma"
]

BIKE_TYPES = ["Road", "Mountain", "Gravel", "Hybrid", "City", "Cross", "Touring"]
FRAME_MATERIALS = ["Aluminum", "Carbon", "Steel", "Titanium"]
WHEEL_SIZES = ["26", "27.5", "29", "700c"]
BRAKE_TYPES = ["Disc", "Rim"]
COLORS = ["Đen", "Trắng", "Xanh", "Đỏ", "Vàng", "Cam", "Hồng", "Xám"]
GROUPSETS = ["Shimano 105", "Shimano Ultegra", "Shimano Tiagra", "SRAM Rival", "SRAM Force", "Shimano Deore"]

DESCRIPTION_TEMPLATES = [
    "Xe đạp {{brand}} {{model}} năm {{year}}, khung {{frame_material}}, tình trạng {{condition}}%.",
    "{{brand}} {{model}} {{year}} với phanh {{brake_type}}, bánh {{wheel_size}} và màu {{color}}.",
    "Chiếc xe đạp tuyệt vời cho đường phố và dã ngoại, bảo dưỡng tốt, chạy chưa quá {{mileage}} km.",
    "Bán nhanh {{brand}} {{model}} dùng cho {{type}}, phù hợp với người yêu thích tốc độ.",
]

IMAGE_SOURCES = [
    "https://picsum.photos/seed/{seed}/640/480",
    "https://placehold.co/640x480?text={brand}+{model}",
]


def get_or_create_test_seller(session):
    seller = session.query(UserModel).filter(UserModel.role.in_(["USER", "ADMIN"])) .first()
    if seller:
        return seller

    seller = UserModel(
        email="seller@example.com",
        password_hash="test-password",
        phone="0900000000",
        full_name="Test Seller",
        role="USER",
    )
    session.add(seller)
    session.commit()
    return seller


def build_description(brand: str, model: str, year: int, condition: int, brake_type: str, wheel_size: str, color: str, bike_type: str, mileage: int) -> str:
    template = random.choice(DESCRIPTION_TEMPLATES)
    return template.replace("{{brand}}", brand).replace("{{model}}", model).replace("{{year}}", str(year)).replace(
        "{{condition}}", str(condition)
    ).replace("{{brake_type}}", brake_type).replace("{{wheel_size}}", wheel_size).replace("{{color}}", color).replace(
        "{{type}}", bike_type
    ).replace("{{mileage}}", str(mileage))


def random_image_urls(brand: str, model: str, index: int) -> List[str]:
    urls = []
    for idx in range(3):
        src = random.choice(IMAGE_SOURCES)
        urls.append(src.format(seed=f"{brand}-{model}-{index}-{idx}", brand=brand, model=model))
    return urls


def create_listings(count: int, status: str = "AVAILABLE") -> None:
    app = create_app()
    with app.app_context():
        session = SessionLocal()
        seller = get_or_create_test_seller(session)

        for idx in range(1, count + 1):
            brand = random.choice(BRANDS)
            model = f"{random.choice(MODEL_SUFFIXES)} {random.randint(1, 9)}{random.choice(['', ' Pro', ' SL', ' S'])}"
            bike_type = random.choice(BIKE_TYPES)
            frame_material = random.choice(FRAME_MATERIALS)
            wheel_size = random.choice(WHEEL_SIZES)
            brake_type = random.choice(BRAKE_TYPES)
            color = random.choice(COLORS)
            year = random.randint(2018, 2025)
            condition_percent = random.randint(70, 100)
            mileage_km = random.randint(0, 6000)
            price = Decimal(random.randint(6_000_000, 55_000_000))
            title = f"{brand} {model} {year}"
            description = build_description(
                brand,
                model,
                year,
                condition_percent,
                brake_type,
                wheel_size,
                color,
                bike_type,
                mileage_km,
            )
            images = random_image_urls(brand, model.replace(' ', '-'), idx)
            listing = Listing(
                seller_id=seller.user_id,
                title=title,
                description=description,
                price=price,
                status=status,
            )
            session.add(listing)
            session.flush()

            bicycle = Bicycle(
                listing_id=listing.listing_id,
                brand=brand,
                model=model,
                type=bike_type,
                frame_size=random.choice(["S", "M", "L", "XL"]),
                frame_material=frame_material,
                wheel_size=wheel_size,
                brake_type=brake_type,
                color=color,
                manufacture_year=year,
                groupset=random.choice(GROUPSETS),
                condition_percent=condition_percent,
                mileage_km=mileage_km,
                serial_number=f"SN{random.randint(100000, 999999)}",
                primary_image_url=images[0],
            )
            session.add(bicycle)

            for image_url in images:
                media = Media(
                    listing_id=listing.listing_id,
                    url=image_url,
                    media_type="IMAGE",
                    is_primary=image_url == images[0],
                )
                session.add(media)

            if idx % 20 == 0:
                session.commit()
                print(f"Đã tạo {idx} listing...")

        session.commit()
        print(f"Hoàn thành tạo {count} listing thành công. Seller_id={seller.user_id}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Tạo nhanh nhiều listing xe đạp để test.")
    parser.add_argument("--count", type=int, default=50, help="Số lượng listing cần tạo")
    parser.add_argument("--status", type=str, default="AVAILABLE", help="Trạng thái của listing")
    args = parser.parse_args()
    create_listings(args.count, status=args.status)


if __name__ == "__main__":
    main()

import React from "react";
import { FiMail, FiPhone, FiMapPin } from "react-icons/fi";
import styles from "./Footer.module.css";

interface FooterProps {}

const Footer: React.FC<FooterProps> = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerContainer}>
        <div className={styles.footerGrid}>
          <div className={styles.footerSection}>
            <h3 className={styles.footerTitle}>
              <span className={styles.footerIcon}>
                <img src="/assets/favicon.ico" width={24} height={24} alt="BikeMarket logo" />
              </span> BikeMarket
            </h3>
            <p className={styles.footerText}>
              Nền tảng mua bán xe đạp uy tín, chất lượng hàng đầu Việt Nam.
            </p>
          </div>
          <div className={styles.footerSection}>
            <h4 className={styles.footerSubtitle}>Liên kết</h4>
            <ul className={styles.footerLinks}>
              <li><a href="#" className={styles.footerLink}>Về chúng tôi</a></li>
              <li><a href="#" className={styles.footerLink}>Chính sách</a></li>
              <li><a href="#" className={styles.footerLink}>Điều khoản</a></li>
              <li><a href="#" className={styles.footerLink}>Hỗ trợ</a></li>
            </ul>
          </div>
          <div className={styles.footerSection}>
            <h4 className={styles.footerSubtitle}>Dịch vụ</h4>
            <ul className={styles.footerLinks}>
              <li><a href="#" className={styles.footerLink}>Định giá xe</a></li>
              <li><a href="#" className={styles.footerLink}>Bảo hành</a></li>
              <li><a href="#" className={styles.footerLink}>Vận chuyển</a></li>
              <li><a href="#" className={styles.footerLink}>Thanh toán</a></li>
            </ul>
          </div>
          <div className={styles.footerSection}>
            <h4 className={styles.footerSubtitle}>Liên hệ</h4>
            <div className={styles.footerContact}>
              <p><FiMail /> bikemarket@bikemarket.vn</p>
              <p><FiPhone /> 1800-0081</p>
              <p><FiMapPin /> Tô Ký, Q.12 TP.HCM, Việt Nam</p>
            </div>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <p>&copy; 2026 BikeMarket. Tất cả quyền được bảo lưu.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import { useChat } from '../../../context/ChatContext';
import styles from './Detail.module.css';

interface Bicycle {
  brand?: string;
  model?: string;
  type?: string;
  condition_percent?: number | string;
  frame_size?: string;
  frame_material?: string;
  wheel_size?: string;
  brake_type?: string;
  color?: string;
  manufacture_year?: string;
  mileage_km?: string;
  groupset?: string;
  serial_number?: string;
}

interface Listing {
  listing_id: number;
  title: string;
  description?: string;
  price: string;
  status: string;
  inspection_status?: string;
  is_verified?: boolean;
  assigned_inspector_id?: number;
  assigned_inspector?: {
    user_id: number;
    name?: string;
    phone?: string;
  };
  seller_id: number;
  seller?: {
    seller_id: number;
    name: string;
    phone?: string;
  };
  bike_details: Bicycle;
  images: string[];
}

const bikeBrands = [
  'Giant',
  'Trek',
  'Specialized',
  'Cannondale',
  'Scott',
  'Merida',
  'Bianchi',
  'Cervelo',
  'Polygon',
  'Other',
];

const bikeTypes = [
  'Road',
  'MTB',
  'Gravel',
  'Touring',
  'Hybrid',
  'Fixie',
  'Folding',
  'Electric',
  'Other',
];

const frameMaterials = ['Carbon', 'Nhôm', 'Thép', 'Titan', 'Hợp kim khác'];
const brakeTypes = ['Phanh dầu', 'Phanh cơ', 'Phanh đĩa', 'Phanh vành'];

const CHECKLIST_ITEMS = [
  { id: 'frame', label: 'Khung sườn (Không nứt, gãy)' },
  { id: 'brakes', label: 'Hệ thống phanh (Hoạt động tốt, an toàn)' },
  { id: 'tires', label: 'Bánh xe & Lốp (Không bị thủng, vành không cong vênh)' },
  { id: 'chain', label: 'Dây xích & Líp (Chạy trơn tru, không gỉ sét nặng)' },
  { id: 'gears', label: 'Bộ truyền động (Chuyển số mượt mà)' },
  { id: 'overall', label: 'Đánh giá tổng thể trùng khớp với mô tả của người bán' },
];

export default function InspectorDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { user, loggedIn, initialized, accessToken } = useAuth();
  const { openConversation } = useChat();

  const [listing, setListing] = useState<Listing | null>(null);
  const [inspectionStarted, setInspectionStarted] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    price: '',
    bike_details: {
      brand: 'Giant',
      model: '',
      type: 'Road',
      condition_percent: '',
      frame_size: '',
      frame_material: 'Carbon',
      wheel_size: '',
      brake_type: 'Phanh dầu',
      color: '',
      manufacture_year: '',
      mileage_km: '',
      groupset: '',
      serial_number: '',
    },
  });
  const [loading, setLoading] = useState(true);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [unassignLoading, setUnassignLoading] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [inspectionCondition, setInspectionCondition] = useState('');
  const [reviewNote, setReviewNote] = useState('');

  useEffect(() => {
    if (!initialized) return;
    if (!loggedIn) {
      router.push('/login');
      return;
    }

    if (user?.role !== 'INSPECTOR') {
      router.push('/');
      return;
    }

    const fetchListing = async () => {
      try {
        const response = await fetch(`/api/listings/${id}`);
        if (!response.ok) {
          const error = await response.json().catch(() => null);
          alert(error?.message || 'Không tìm thấy tin đăng!');
          return;
        }
        const data = await response.json();
        setListing(data);
        if (data.status === 'PENDING' && (!data.inspection_status || data.inspection_status === 'NONE')) {
          setInspectionStarted(true);
        }
      } catch (err) {
        console.error(err);
        alert('Không tìm thấy tin đăng!');
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
  }, [id, initialized, loggedIn, router, user]);

  useEffect(() => {
    if (!listing) return;

    setEditForm({
      title: listing.title || '',
      description: listing.description || '',
      price: listing.price || '',
      bike_details: {
        brand: listing.bike_details?.brand || '',
        model: listing.bike_details?.model || '',
        type: listing.bike_details?.type || '',
        condition_percent: String(listing.bike_details?.condition_percent ?? ''),
        frame_size: listing.bike_details?.frame_size || '',
        frame_material: listing.bike_details?.frame_material || '',
        wheel_size: listing.bike_details?.wheel_size || '',
        brake_type: listing.bike_details?.brake_type || '',
        color: listing.bike_details?.color || '',
        manufacture_year: listing.bike_details?.manufacture_year || '',
        mileage_km: listing.bike_details?.mileage_km || '',
        groupset: listing.bike_details?.groupset || '',
        serial_number: listing.bike_details?.serial_number || '',
      },
    });
  }, [listing]);

  const handleEditChange = (field: string, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleBikeDetailChange = (field: keyof Bicycle, value: string) => {
    setEditForm((prev) => ({
      ...prev,
      bike_details: {
        ...prev.bike_details,
        [field]: field === 'condition_percent' && value !== '' ? Number(value) : value,
      },
    }));
  };

  const inspectedByMe = Boolean(
    listing?.assigned_inspector_id &&
      user?.user_id &&
      listing.assigned_inspector_id === user.user_id
  );

  const isPendingApprovalListing = Boolean(
    listing?.status === 'PENDING' && (!listing?.inspection_status || listing.inspection_status === 'NONE')
  );

  const verifiedVehicle = Boolean(
    listing?.is_verified || listing?.inspection_status === 'PASSED'
  );

  const inspectionAssignedToMe = Boolean(
    inspectedByMe && listing?.inspection_status === 'SCHEDULED'
  );

  const inspectionAllowed = !verifiedVehicle;

  const handleStartInspection = async () => {
    if (!listing) return;

    if (verifiedVehicle) {
      alert('Xe đã được xác minh. Bạn chỉ có thể xem thông tin, không thể kiểm định lại.');
      return;
    }

    if (inspectionAssignedToMe || isPendingApprovalListing) {
      setInspectionStarted(true);
      setSaveMessage(null);
      return;
    }

    if (!accessToken) {
      alert('Vui lòng đăng nhập để nhận kiểm định');
      return;
    }

    setAssignLoading(true);
    try {
      const response = await fetch(`/api/listings/${id}/assign-inspector`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Không thể nhận kiểm định.');
      }
      setListing(data);
      setInspectionStarted(true);
      setSaveMessage(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Không thể nhận kiểm định.';
      alert(errorMessage);
    } finally {
      setAssignLoading(false);
    }
  };

  const handleCancelInspection = async () => {
    if (!listing) return;

    if (inspectionAssignedToMe) {
      setUnassignLoading(true);
      try {
        const response = await fetch(`/api/listings/${id}/unassign-inspector`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || 'Không thể hủy nhận kiểm định.');
        }
        setListing(data);
        router.push('/inspector');
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Không thể hủy nhận kiểm định.';
        alert(errorMessage);
      } finally {
        setUnassignLoading(false);
      }
    } else {
      router.push('/inspector');
    }
  };

  const handleSaveChanges = async () => {
    if (!listing) return;
    setSavingChanges(true);
    setSaveMessage(null);

    try {
      const response = await fetch(`/api/listings/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description,
          price: editForm.price,
          images: listing.images,
          bike_details: editForm.bike_details,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Lưu thay đổi thất bại.');
      }
      setListing({
        ...listing,
        title: editForm.title,
        description: editForm.description,
        price: editForm.price,
        bike_details: {
          ...listing.bike_details,
          ...editForm.bike_details,
        },
        images: listing.images,
      });
      setSaveMessage('Lưu thông tin thành công.');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Lỗi khi lưu thông tin.';
      setSaveMessage(errorMessage);
    } finally {
      setSavingChanges(false);
    }
  };

  const handleCheck = (itemId: string) => {
    setChecks((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const allChecked = CHECKLIST_ITEMS.every((item) => checks[item.id]);

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      const payload: { 
        action: string; 
        checklist?: Record<string, boolean>;
        technical_details?: Record<string, unknown>;
        review_only?: boolean;
      } = { action: 'PASS' };
      if (!isPendingApprovalListing) {
        if (!allChecked) {
          alert('Cần hoàn tất checklist trước khi duyệt.');
          return;
        }
        if (Number(inspectionCondition) < 80) {
          alert('Không thể duyệt. Độ mới phải từ 80% trở lên.');
          return;
        }
        payload.technical_details = { condition_percent: Number(inspectionCondition) };
      } else {
        payload.review_only = true;
      }
      const response = await fetch(`/api/listings/${id}/inspect`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        alert(isPendingApprovalListing ? 'Đã duyệt tin đăng thành công.' : 'Kiểm định thành công. Đã gắn tích xanh cho xe!');
        router.push('/inspector');
      } else {
        const err = await response.json();
        alert(`Lỗi: ${err.message}`);
      }
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi phê duyệt');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!confirm(`Bạn có chắc chắn muốn TỪ CHỐI tin đăng này?`)) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/listings/${id}/inspect`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'FAIL',
          overall_verdict: reviewNote.trim() || (isPendingApprovalListing ? 'Tin đăng bị từ chối' : 'Từ chối duyệt tin.'),
          technical_details: isPendingApprovalListing ? {} : { condition_percent: Number(inspectionCondition) },
        }),
      });
      if (response.ok) {
        alert(isPendingApprovalListing ? 'Đã từ chối tin đăng thành công.' : 'Đã từ chối tin đăng thành công.');
        router.push('/inspector');
      } else {
        const err = await response.json();
        alert(`Lỗi: ${err.message}`);
      }
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi từ chối');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReport = async () => {
    if (!reviewNote.trim()) {
      alert('Vui lòng nhập nội dung báo cáo.');
      return;
    }
    if (!confirm('Bạn có chắc chắn muốn gửi báo cáo cho tin đăng này?')) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/listings/${id}/inspect`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'FAIL',
          overall_verdict: `Báo cáo vi phạm: ${reviewNote.trim()}`,
          technical_details: {},
        }),
      });
      if (response.ok) {
        alert('Báo cáo tin đăng đã được gửi.');
        router.push('/inspector');
      } else {
        const err = await response.json();
        alert(`Lỗi: ${err.message}`);
      }
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi gửi báo cáo');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className={styles.container}><div className={styles.loading}>Đang tải chi tiết xe...</div></div>;
  if (!listing) return <div className={styles.container}><div>Không tìm thấy xe.</div></div>;

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <div className={styles.header}>
          <Link href="/inspector" className={styles.backLink}>
            ← Quay lại danh sách
          </Link>
          <h1 className={styles.title}>
            {isPendingApprovalListing ? 'Duyệt tin đăng:' : 'Biên Bản Kiểm Định:'} {listing.title}
          </h1>
        </div>

        <div className={styles.actionRow}>
          <button
            type="button"
            className={styles.chatButton}
            onClick={() =>
              openConversation({
                sellerId: listing.seller_id,
                sellerName: listing.seller?.name || `Người bán #${listing.seller_id}`,
                listingId: listing.listing_id,
                listingTitle: listing.title,
              })
            }
          >
            Chat với người bán
          </button>
          {!verifiedVehicle && !isPendingApprovalListing && (
            <button
              type="button"
              className={`${styles.requestChangeBtn} ${showEditForm ? styles.activeEditBtn : ''}`}
              onClick={() => setShowEditForm((prev) => !prev)}
            >
              Thay đổi thông tin
            </button>
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.grid}>
            <div>
              <div className={styles.label}>Tiêu đề</div>
              <div className={styles.value}>{listing.title}</div>
            </div>
            <div>
              <div className={styles.label}>Giá</div>
              <div className={styles.value}>{parseInt(listing.price, 10).toLocaleString('vi-VN')} ₫</div>
            </div>
            <div>
              <div className={styles.label}>Hãng xe</div>
              <div className={styles.value}>{listing.bike_details?.brand || 'Không xác định'}</div>
            </div>
            <div>
              <div className={styles.label}>Model</div>
              <div className={styles.value}>{listing.bike_details?.model || 'Không xác định'}</div>
            </div>
            <div>
              <div className={styles.label}>Loại xe</div>
              <div className={styles.value}>{listing.bike_details?.type || 'Không xác định'}</div>
            </div>
            <div>
              <div className={styles.label}>Độ mới</div>
              <div className={styles.value}>
                {listing.bike_details?.condition_percent !== undefined && listing.bike_details?.condition_percent !== null
                  ? `${listing.bike_details.condition_percent}%`
                  : 'Không xác định'}
              </div>
            </div>
            <div>
              <div className={styles.label}>Dòng khung</div>
              <div className={styles.value}>{listing.bike_details?.frame_size || 'Không xác định'}</div>
            </div>
            <div>
              <div className={styles.label}>Chất liệu khung</div>
              <div className={styles.value}>{listing.bike_details?.frame_material || 'Không xác định'}</div>
            </div>
            <div>
              <div className={styles.label}>Kích cỡ bánh</div>
              <div className={styles.value}>{listing.bike_details?.wheel_size || 'Không xác định'}</div>
            </div>
            <div>
              <div className={styles.label}>Loại phanh</div>
              <div className={styles.value}>{listing.bike_details?.brake_type || 'Không xác định'}</div>
            </div>
            <div>
              <div className={styles.label}>Màu sắc</div>
              <div className={styles.value}>{listing.bike_details?.color || 'Không xác định'}</div>
            </div>
            <div>
              <div className={styles.label}>Năm sx</div>
              <div className={styles.value}>{listing.bike_details?.manufacture_year || 'Không xác định'}</div>
            </div>
            <div>
              <div className={styles.label}>Quãng đường</div>
              <div className={styles.value}>{listing.bike_details?.mileage_km || 'Không xác định'} km</div>
            </div>
            <div>
              <div className={styles.label}>Bộ nhóm</div>
              <div className={styles.value}>{listing.bike_details?.groupset || 'Không xác định'}</div>
            </div>
            <div>
              <div className={styles.label}>Số khung</div>
              <div className={styles.value}>{listing.bike_details?.serial_number || 'Không xác định'}</div>
            </div>
          </div>

          <div className={styles.descriptionBlock}>
            <div className={styles.label}>Mô tả</div>
            <div className={styles.value}>{listing.description || 'Chưa có mô tả'}</div>
          </div>

          <div style={{ marginTop: '20px' }}>
            {listing.images && listing.images.length > 0 && (
              <img
                src={listing.images[0]}
                alt="Xe"
                style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', borderRadius: '8px' }}
              />
            )}
          </div>
        </div>

        <div className={styles.startInspectionWrapper}>
          <div className={styles.inspectionIntro}>
            <p>
              {verifiedVehicle
                ? 'Xe đã được xác minh. Kiểm định viên chỉ có thể xem lại thông tin, không thể xử lý hay thay đổi.'
                : isPendingApprovalListing
                ? 'Đây là tin đăng chờ duyệt. Xem kỹ thông tin, sau đó nhấn Kiểm tra để duyệt hoặc từ chối.'
                : inspectionAssignedToMe
                ? 'Bạn đã nhận kiểm định chiếc này. Nhấn Tiến hành kiểm định để mở phần checklist và chỉnh sửa thông tin.'
                : 'Nhấn Tiến hành kiểm định để nhận xe và mở quyền chỉnh sửa thông tin.'}
            </p>
          </div>
          <div className={styles.inspectionActionsRow}>
            <button
              type="button"
              className={styles.startInspectionBtn}
              onClick={handleStartInspection}
              disabled={assignLoading || verifiedVehicle}
            >
              {assignLoading
                ? 'Đang xử lý...'
                : verifiedVehicle
                ? 'Xe đã xác minh'
                : isPendingApprovalListing
                ? 'Kiểm tra'
                : 'Tiến hành kiểm định'}
            </button>
          </div>
        </div>
        {inspectionStarted && (
          <div>
            {showEditForm && inspectionAllowed && !isPendingApprovalListing && (
              <div className={styles.editForm}>
                <h2 className={styles.sectionTitle}>Thông tin sửa đổi</h2>
                {verifiedVehicle && (
                  <div className={styles.helperText}>
                    Xe đã được xác minh, chỉ chỉnh sửa Giá và Mô tả. Các trường khác giữ nguyên.
                  </div>
                )}
                <div className={styles.formRow}>
                  <label>Tiêu đề</label>
                  <input
                    value={editForm.title}
                    onChange={(event) => handleEditChange('title', event.target.value)}
                    className={styles.inputField}
                  />
                </div>
                <div className={styles.formRow}>
                  <label>Giá</label>
                  <input
                    value={editForm.price}
                    onChange={(event) => handleEditChange('price', event.target.value)}
                    className={styles.inputField}
                  />
                </div>
                <div className={styles.formRow}>
                  <label>Mô tả</label>
                  <textarea
                    value={editForm.description}
                    onChange={(event) => handleEditChange('description', event.target.value)}
                    className={styles.textareaField}
                    rows={4}
                  />
                </div>
                <div className={styles.formRow}>
                  <label>Hãng</label>
                  <select
                    value={editForm.bike_details.brand}
                    onChange={(event) => handleBikeDetailChange('brand', event.target.value)}
                    className={styles.inputField}
                    disabled={verifiedVehicle}
                  >
                    {bikeBrands.map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formRow}>
                  <label>Model</label>
                  <input
                    value={editForm.bike_details.model}
                    onChange={(event) => handleBikeDetailChange('model', event.target.value)}
                    className={styles.inputField}
                    disabled={verifiedVehicle}
                  />
                </div>
                <div className={styles.formRow}>
                  <label>Loại xe</label>
                  <select
                    value={editForm.bike_details.type}
                    onChange={(event) => handleBikeDetailChange('type', event.target.value)}
                    className={styles.inputField}
                    disabled={verifiedVehicle}
                  >
                    {bikeTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formRow}>
                  <label>Khung</label>
                  <input
                    value={editForm.bike_details.frame_size}
                    onChange={(event) => handleBikeDetailChange('frame_size', event.target.value)}
                    className={styles.inputField}
                    disabled={verifiedVehicle}
                  />
                </div>
                <div className={styles.formRow}>
                  <label>Chất liệu</label>
                  <select
                    value={editForm.bike_details.frame_material}
                    onChange={(event) => handleBikeDetailChange('frame_material', event.target.value)}
                    className={styles.inputField}
                    disabled={verifiedVehicle}
                  >
                    {frameMaterials.map((material) => (
                      <option key={material} value={material}>
                        {material}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formRow}>
                  <label>Lốp</label>
                  <input
                    value={editForm.bike_details.wheel_size}
                    onChange={(event) => handleBikeDetailChange('wheel_size', event.target.value)}
                    className={styles.inputField}
                    disabled={verifiedVehicle}
                  />
                </div>
                <div className={styles.formRow}>
                  <label>Phanh</label>
                  <select
                    value={editForm.bike_details.brake_type}
                    onChange={(event) => handleBikeDetailChange('brake_type', event.target.value)}
                    className={styles.inputField}
                    disabled={verifiedVehicle}
                  >
                    {brakeTypes.map((brake) => (
                      <option key={brake} value={brake}>
                        {brake}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formRow}>
                  <label>Màu</label>
                  <input
                    value={editForm.bike_details.color}
                    onChange={(event) => handleBikeDetailChange('color', event.target.value)}
                    className={styles.inputField}
                    disabled={verifiedVehicle}
                  />
                </div>
                <div className={styles.formRow}>
                  <label>Năm sản xuất</label>
                  <input
                    value={editForm.bike_details.manufacture_year}
                    onChange={(event) => handleBikeDetailChange('manufacture_year', event.target.value)}
                    className={styles.inputField}
                    disabled={verifiedVehicle}
                  />
                </div>
                <div className={styles.formRow}>
                  <label>Quãng đường</label>
                  <input
                    value={editForm.bike_details.mileage_km}
                    onChange={(event) => handleBikeDetailChange('mileage_km', event.target.value)}
                    className={styles.inputField}
                    disabled={verifiedVehicle}
                  />
                </div>
                <div className={styles.formRow}>
                  <label>Bộ nhóm</label>
                  <input
                    value={editForm.bike_details.groupset}
                    onChange={(event) => handleBikeDetailChange('groupset', event.target.value)}
                    className={styles.inputField}
                    disabled={verifiedVehicle}
                  />
                </div>
                <div className={styles.formRow}>
                  <label>Số khung</label>
                  <input
                    value={editForm.bike_details.serial_number}
                    onChange={(event) => handleBikeDetailChange('serial_number', event.target.value)}
                    className={styles.inputField}
                    disabled={verifiedVehicle}
                  />
                </div>
                {saveMessage && <div className={styles.saveMessage}>{saveMessage}</div>}
                <div className={styles.formActions}>
                  <button
                    type="button"
                    className={styles.saveBtn}
                    onClick={handleSaveChanges}
                    disabled={savingChanges}
                  >
                    {savingChanges ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </div>
              </div>
            )}
            {!verifiedVehicle && !isPendingApprovalListing && (
              <div className={styles.checklistSection}>
                <h2 className={styles.checkTitle}>Checklist Đánh Giá Tình Trạng</h2>
                <div className={styles.checklist}>
                  {CHECKLIST_ITEMS.map((item) => (
                    <div key={item.id} className={styles.checkItem} onClick={() => handleCheck(item.id)}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={!!checks[item.id]}
                        readOnly
                      />
                      <span className={styles.checkLabel}>{item.label}</span>
                    </div>
                  ))}
                </div>
                {allChecked ? (
                  <div className={styles.formRow}>
                    <label>Độ mới thực tế (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={inspectionCondition}
                      onChange={(event) => setInspectionCondition(event.target.value)}
                      className={styles.inputField}
                    />
                    <div className={styles.helperText}>
                      Nhập độ mới do kiểm định viên. Xe phải có ít nhất 80% để đạt chuẩn.
                    </div>
                  </div>
                ) : (
                  <div className={styles.helperText}>
                    Hoàn tất checklist trước khi nhập độ mới.
                  </div>
                )}

                <div className={styles.actions}>
                  <button className={styles.cancelBtn} onClick={handleCancelInspection} disabled={unassignLoading}>
                    {unassignLoading ? 'Đang hủy...' : 'Hủy bỏ kiểm định'}
                  </button>
                  <button className={styles.rejectBtn} onClick={handleReject} disabled={isSubmitting}>
                    Không đạt / Từ chối
                  </button>
                  <button
                    className={styles.approveBtn}
                    onClick={handleApprove}
                    disabled={!allChecked || isSubmitting || Number(inspectionCondition) < 80}
                    title={!allChecked ? 'Cần tick hết tất cả hạng mục trước khi duyệt' : Number(inspectionCondition) < 80 ? 'Độ mới phải từ 80% trở lên' : ''}
                  >
                    Đạt chuẩn
                  </button>
                </div>
              </div>
            )}
            {isPendingApprovalListing && (
              <div className={styles.reviewSection}>
                <h2 className={styles.checkTitle}>Duyệt tin đăng</h2>
                <p className={styles.helperText}>
                  Kiểm tra thông tin người bán đăng có chính xác, không vi phạm nội quy. Nếu hợp lệ, chọn Duyệt tin. Nếu không hợp lệ hoặc có vấn đề, chọn Từ chối hoặc Báo cáo.
                </p>

                <div className={styles.formRow}>
                  <label>Nội dung báo cáo / lý do từ chối</label>
                  <textarea
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    className={styles.textareaField}
                    rows={4}
                    placeholder="Ghi rõ lý do từ chối hoặc nội dung báo cáo nếu cần"
                  />
                </div>

                <div className={styles.actions}>
                  <button className={styles.cancelBtn} onClick={handleCancelInspection} disabled={unassignLoading}>
                    Quay lại danh sách
                  </button>
                  <button className={styles.rejectBtn} onClick={handleReject} disabled={isSubmitting}>
                    Từ chối tin
                  </button>
                  <button className={styles.reportBtn} onClick={handleReport} disabled={isSubmitting || !reviewNote.trim()}>
                    Báo cáo
                  </button>
                  <button className={styles.approveBtn} onClick={handleApprove} disabled={isSubmitting}>
                    Duyệt tin
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

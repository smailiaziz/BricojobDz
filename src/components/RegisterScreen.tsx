import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Wrench, 
  Mail, 
  Lock, 
  Check, 
  AlertTriangle, 
  Phone, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  CheckCircle2
} from 'lucide-react';
import { Artisan, ServiceCategory, UserSession } from '../types';
import { 
  isValidEmail, 
  isValidAlgerianPhone, 
  normalizePhoneNumber
} from '../utils';
import { authService } from '../services/authService';

interface RegisterScreenProps {
  currentUser?: UserSession | null;
  categories: ServiceCategory[];
  onBack: () => void;
  onNavigateToLogin: () => void;
  onRegisterSuccess: (newUser: UserSession, newArtisan?: Artisan) => void;
  onShowToast: (text: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

// Helper to evaluate all 5 password requirements
export const checkPasswordRequirements = (pwd: string) => {
  const p = pwd || '';
  const hasMinLength = p.length >= 8;
  const hasUppercase = /[A-Z]/.test(p);
  const hasLowercase = /[a-z]/.test(p);
  const hasNumber = /\d/.test(p);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(p);

  const count = (hasMinLength ? 1 : 0) + 
                (hasUppercase ? 1 : 0) + 
                (hasLowercase ? 1 : 0) + 
                (hasNumber ? 1 : 0) + 
                (hasSymbol ? 1 : 0);

  return {
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSymbol,
    count,
    isValid: count === 5,
  };
};

export const RegisterScreen: React.FC<RegisterScreenProps> = ({
  currentUser,
  categories,
  onNavigateToLogin,
  onRegisterSuccess,
  onShowToast,
}) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'artisan') {
        navigate('/artisan', { replace: true });
      } else {
        navigate('/search', { replace: true });
      }
    }
  }, [currentUser, navigate]);

  const [accountType, setAccountType] = useState<'user' | 'artisan'>('user');

  // Register Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [termsError, setTermsError] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Safe early return after all React hooks are declared
  if (currentUser) {
    return null;
  }

  // Helper for email format validation
  const validateEmailFormat = (val: string): string => {
    const trimmed = val.trim();
    if (!trimmed) {
      return 'يرجى إدخال البريد الإلكتروني.';
    }
    if (!isValidEmail(trimmed)) {
      return 'يرجى إدخال بريد إلكتروني صحيح (مثال: name@domain.com).';
    }
    return '';
  };

  const handleRegisterEmailBlur = () => {
    setEmailTouched(true);
    setEmailError(validateEmailFormat(email));
  };

  const handleRegisterEmailChange = (val: string) => {
    setEmail(val);
    if (emailTouched) {
      setEmailError(validateEmailFormat(val));
    }
  };

  // Handle Register Submission
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    let hasErrors = false;
    let firstErrorElementId: string | null = null;

    // 1. Name validation
    if (!name.trim()) {
      setNameError('يرجى إدخال الاسم الكامل أو اسم المستخدم.');
      hasErrors = true;
      if (!firstErrorElementId) firstErrorElementId = 'field-name';
    } else {
      setNameError('');
    }

    // 2. Email validation
    setEmailTouched(true);
    const regEmailErr = validateEmailFormat(email);
    if (regEmailErr) {
      setEmailError(regEmailErr);
      hasErrors = true;
      if (!firstErrorElementId) firstErrorElementId = 'field-email';
    } else {
      setEmailError('');
    }

    // 3. Phone validation (Optional - only validate format if provided)
    if (phone.trim() && !isValidAlgerianPhone(phone)) {
      setPhoneError('يرجى إدخال رقم هاتف جزائري صحيح يتكون من 10 أرقام (مثال: 0550123456).');
      hasErrors = true;
      if (!firstErrorElementId) firstErrorElementId = 'field-phone';
    } else {
      setPhoneError('');
    }

    // 4. Password validation
    const pwdReqs = checkPasswordRequirements(password);
    if (!password) {
      setPasswordError('يرجى إدخال كلمة المرور.');
      hasErrors = true;
      if (!firstErrorElementId) firstErrorElementId = 'field-password';
    } else if (!pwdReqs.isValid) {
      if (!pwdReqs.hasMinLength) {
        setPasswordError('كلمة المرور يجب أن تتكون من 8 أحرف على الأقل.');
      } else if (!pwdReqs.hasUppercase) {
        setPasswordError('كلمة المرور يجب أن تحتوي على حرف إنجليزي كبير واحد على الأقل (A-Z).');
      } else if (!pwdReqs.hasLowercase) {
        setPasswordError('كلمة المرور يجب أن تحتوي على حرف إنجليزي صغير واحد على الأقل (a-z).');
      } else if (!pwdReqs.hasNumber) {
        setPasswordError('كلمة المرور يجب أن تحتوي على رقم واحد على الأقل (0-9).');
      } else if (!pwdReqs.hasSymbol) {
        setPasswordError('كلمة المرور يجب أن تحتوي على رمز خاص واحد على الأقل (مثل @, #, $, !).');
      }
      hasErrors = true;
      if (!firstErrorElementId) firstErrorElementId = 'field-password';
    } else {
      setPasswordError('');
    }

    // 5. Confirm password validation
    if (!confirmPassword) {
      setConfirmPasswordError('يرجى تأكيد كلمة المرور.');
      hasErrors = true;
      if (!firstErrorElementId) firstErrorElementId = 'field-confirm-password';
    } else if (password && password !== confirmPassword) {
      setConfirmPasswordError('كلمات المرور غير متطابقة.');
      hasErrors = true;
      if (!firstErrorElementId) firstErrorElementId = 'field-confirm-password';
    } else {
      setConfirmPasswordError('');
    }

    // 6. Terms & Conditions check
    if (!agreedToTerms) {
      setTermsError('يرجى الموافقة على شروط الاستخدام وسياسة الخصوصية للمتابعة.');
      hasErrors = true;
      if (!firstErrorElementId) firstErrorElementId = 'field-terms';
    } else {
      setTermsError('');
    }

    // Stop and scroll to first error if validation failed
    if (hasErrors) {
      setError('يرجى تصحيح الأخطاء الموضحة أدناه للمتابعة.');
      if (firstErrorElementId) {
        const el = document.getElementById(firstErrorElementId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (el instanceof HTMLInputElement && el.type !== 'checkbox') {
            el.focus();
          }
        }
      }
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check for Duplicate Email via authService
    try {
      const emailExists = await authService.requestPasswordReset(cleanEmail);
      if (emailExists) {
        setEmailError('هذا البريد الإلكتروني مسجل مسبقاً! يرجى استخدام بريد آخر أو تسجيل الدخول.');
        setError('هذا البريد الإلكتروني مسجل مسبقاً! يرجى استخدام بريد آخر أو تسجيل الدخول.');
        const el = document.getElementById('field-email');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus();
        }
        return;
      }
    } catch {
      // Ignore parse errors if any
    }

    setIsSubmitting(true);

    try {
      const { user: registeredUser, newArtisan: registeredArtisan } = await authService.register({
        name: name.trim(),
        email: email.trim(),
        password,
        role: accountType,
        phone: phone.trim() ? normalizePhoneNumber(phone) : undefined,
      });

      setIsSubmitting(false);
      onRegisterSuccess(registeredUser, registeredArtisan);
      onShowToast(`أهلاً بك يا ${name.trim()}! تم إنشاء الحساب بنجاح.`, 'success');
    } catch (err: any) {
      setIsSubmitting(false);
      if (err?.message === 'EMAIL_EXISTS') {
        setEmailError('هذا البريد الإلكتروني مسجل مسبقاً! يرجى استخدام بريد آخر أو تسجيل الدخول.');
        setError('هذا البريد الإلكتروني مسجل مسبقاً! يرجى استخدام بريد آخر أو تسجيل الدخول.');
        const el = document.getElementById('field-email');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (el instanceof HTMLInputElement) el.focus();
        }
      } else {
        onShowToast('حدث خطأ أثناء إنشاء الحساب، يرجى المحاولة لاحقاً.', 'error');
      }
    }
  };

  const pwdRequirements = checkPasswordRequirements(password);

  return (
    <div className="w-full space-y-5 animate-fade-in font-['Cairo',sans-serif] px-3.5 py-4 bg-[#FAF8F5] min-h-[100dvh]" dir="rtl">
      
      {/* Main Registration Container */}
      <main className="w-full flex flex-col justify-center">
        
        {/* Header without badge */}
        <div className="text-center mb-6 space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
            أنشئ حسابك على BricojobDz
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 max-w-md mx-auto leading-relaxed">
            انضم إلى BricojobDz واكتشف الخدمات والحرفيين، أو اعرض خدماتك وابدأ في استقبال الطلبات.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl border border-stone-200/80 shadow-xs overflow-hidden p-5 sm:p-8">
          
          {/* Account Type Selector */}
          <div className="mb-6">
            <label className="block text-xs sm:text-sm font-extrabold text-stone-900 mb-3 text-center">
              اختر نوع الحساب
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAccountType('user')}
                className={`flex items-center gap-3.5 p-3.5 rounded-2xl border-2 transition-all duration-200 cursor-pointer text-right relative ${
                  accountType === 'user' 
                    ? 'border-emerald-700 bg-emerald-50/60 text-emerald-900 shadow-xs' 
                    : 'border-stone-200/80 bg-white text-stone-600 hover:border-emerald-200 hover:bg-stone-50/60'
                }`}
              >
                <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${accountType === 'user' ? 'bg-emerald-700 text-white shadow-xs' : 'bg-stone-100 text-stone-400'}`}>
                  <User className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-xs sm:text-sm text-stone-900">عميل</h3>
                  <p className="text-[10px] text-stone-500 mt-0.5 leading-tight">للبحث عن حرفيين وطلب الخدمات</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                  accountType === 'user' ? 'border-emerald-700 bg-emerald-700' : 'border-stone-300 bg-white'
                }`}>
                  {accountType === 'user' && <Check className="w-3 h-3 text-white stroke-[3]" />}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAccountType('artisan')}
                className={`flex items-center gap-3.5 p-3.5 rounded-2xl border-2 transition-all duration-200 cursor-pointer text-right relative ${
                  accountType === 'artisan' 
                    ? 'border-emerald-700 bg-emerald-50/60 text-emerald-900 shadow-xs' 
                    : 'border-stone-200/80 bg-white text-stone-600 hover:border-emerald-200 hover:bg-stone-50/60'
                }`}
              >
                <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${accountType === 'artisan' ? 'bg-emerald-700 text-white shadow-xs' : 'bg-stone-100 text-stone-400'}`}>
                  <Wrench className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-xs sm:text-sm text-stone-900">حرفي</h3>
                  <p className="text-[10px] text-stone-500 mt-0.5 leading-tight">لعرض خدماتك واستقبال طلبات العملاء</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                  accountType === 'artisan' ? 'border-emerald-700 bg-emerald-700' : 'border-stone-300 bg-white'
                }`}>
                  {accountType === 'artisan' && <Check className="w-3 h-3 text-white stroke-[3]" />}
                </div>
              </button>
            </div>
            <p className="text-[11px] text-stone-500 text-center mt-2.5 font-medium">
              نفس بيانات التسجيل الأساسية مطلوبة لكلا النوعين.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-bold rounded-2xl text-center flex items-center justify-center gap-2 animate-shake">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form noValidate onSubmit={handleRegisterSubmit} className="space-y-5">
            
            {/* Required Fields Section */}
            <div className="space-y-4">
              
              {/* Field 1: Name */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1.5">
                  الاسم الكامل أو اسم المستخدم <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute right-3.5 top-3.5 w-4 h-4 text-stone-400" />
                  <input
                    id="field-name"
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (nameError) setNameError('');
                    }}
                    placeholder="مثال: كريم عمراني"
                    className={`w-full bg-stone-50/60 border rounded-xl pr-10 pl-3.5 py-2.5 text-xs sm:text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 transition ${
                      nameError
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-400 bg-rose-50/30'
                        : 'border-stone-200 focus:ring-emerald-700 focus:border-emerald-700 focus:bg-white'
                    }`}
                  />
                </div>
                {nameError && (
                  <p className="text-[11px] text-rose-600 font-bold mt-1.5 flex items-center gap-1 animate-fade-in">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{nameError}</span>
                  </p>
                )}
              </div>

              {/* Field 2: Email */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1.5">
                  البريد الإلكتروني <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute right-3.5 top-3.5 w-4 h-4 text-stone-400" />
                  <input
                    id="field-email"
                    type="email"
                    dir="ltr"
                    value={email}
                    onChange={(e) => handleRegisterEmailChange(e.target.value)}
                    onBlur={handleRegisterEmailBlur}
                    placeholder="email@example.com"
                    className={`w-full bg-stone-50/60 border rounded-xl pr-10 pl-3.5 py-2.5 text-xs sm:text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 transition text-right ${
                      emailError
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-400 bg-rose-50/30'
                        : 'border-stone-200 focus:ring-emerald-700 focus:border-emerald-700 focus:bg-white'
                    }`}
                  />
                </div>
                {emailError && (
                  <p className="text-[11px] text-rose-600 font-bold mt-1.5 flex items-center gap-1 animate-fade-in">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{emailError}</span>
                  </p>
                )}
              </div>

              {/* Field 3: Phone (Optional) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-stone-700">
                    رقم الهاتف
                  </label>
                  <span className="text-[10px] text-stone-400 font-bold bg-stone-100 px-2 py-0.5 rounded-full">
                    اختياري
                  </span>
                </div>
                <div className="relative">
                  <Phone className="absolute right-3.5 top-3.5 w-4 h-4 text-stone-400" />
                  <input
                    id="field-phone"
                    type="tel"
                    dir="ltr"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (phoneError) setPhoneError('');
                    }}
                    placeholder="0550123456"
                    className={`w-full bg-stone-50/60 border rounded-xl pr-10 pl-3.5 py-2.5 text-xs sm:text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 transition text-right ${
                      phoneError
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-400 bg-rose-50/30'
                        : 'border-stone-200 focus:ring-emerald-700 focus:border-emerald-700 focus:bg-white'
                    }`}
                  />
                </div>
                {phoneError ? (
                  <p className="text-[11px] text-rose-600 font-bold mt-1.5 flex items-center gap-1 animate-fade-in">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{phoneError}</span>
                  </p>
                ) : (
                  <p className="text-[10px] text-stone-500 mt-1">
                    صيغة أرقام الهواتف الجزائرية (مثال: 0550123456).
                  </p>
                )}
              </div>

              {/* Field 4 & 5: Password & Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1.5">
                    كلمة المرور <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute right-3.5 top-3.5 w-4 h-4 text-stone-400" />
                    <input
                      id="field-password"
                      type={showRegisterPassword ? 'text' : 'password'}
                      dir="ltr"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (passwordError) setPasswordError('');
                        if (confirmPasswordError && confirmPassword === e.target.value) setConfirmPasswordError('');
                      }}
                      placeholder="••••••••"
                      className={`w-full bg-stone-50/60 border rounded-xl pr-10 pl-10 py-2.5 text-xs sm:text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 transition text-right ${
                        passwordError
                          ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-400 bg-rose-50/30'
                          : 'border-stone-200 focus:ring-emerald-700 focus:border-emerald-700 focus:bg-white'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                      className="absolute left-3 top-2.5 p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-lg transition cursor-pointer"
                      title={showRegisterPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                      aria-label={showRegisterPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                    >
                      {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordError && (
                    <p className="text-[11px] text-rose-600 font-bold mt-1.5 flex items-center gap-1 animate-fade-in">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{passwordError}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1.5">
                    تأكيد كلمة المرور <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute right-3.5 top-3.5 w-4 h-4 text-stone-400" />
                    <input
                      id="field-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      dir="ltr"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (confirmPasswordError) setConfirmPasswordError('');
                      }}
                      placeholder="••••••••"
                      className={`w-full bg-stone-50/60 border rounded-xl pr-10 pl-10 py-2.5 text-xs sm:text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 transition text-right ${
                        confirmPasswordError
                          ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-400 bg-rose-50/30'
                          : 'border-stone-200 focus:ring-emerald-700 focus:border-emerald-700 focus:bg-white'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute left-3 top-2.5 p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-lg transition cursor-pointer"
                      title={showConfirmPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                      aria-label={showConfirmPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPasswordError && (
                    <p className="text-[11px] text-rose-600 font-bold mt-1.5 flex items-center gap-1 animate-fade-in">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{confirmPasswordError}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Password Requirements Checklist Display */}
              <div className="space-y-2 p-3.5 bg-stone-50/80 border border-stone-200/80 rounded-2xl animate-fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-800">متطلبات كلمة المرور:</span>
                  <span className={`font-black text-[11px] ${
                    pwdRequirements.count === 5 ? 'text-emerald-700' :
                    pwdRequirements.count >= 3 ? 'text-amber-600' : 'text-stone-400'
                  }`}>
                    {pwdRequirements.count === 5 ? 'مستوفاة بالكامل 🛡️' : `${pwdRequirements.count} من 5`}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs pt-1">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] transition-colors ${
                    pwdRequirements.hasMinLength ? 'bg-emerald-100/80 text-emerald-800 font-bold' : 'bg-white text-stone-500 border border-stone-200/80'
                  }`}>
                    {pwdRequirements.hasMinLength ? <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0 stroke-[3]" /> : <div className="w-3.5 h-3.5 rounded-full border border-stone-300 shrink-0" />}
                    <span>8 أحرف على الأقل</span>
                  </div>

                  <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] transition-colors ${
                    pwdRequirements.hasUppercase ? 'bg-emerald-100/80 text-emerald-800 font-bold' : 'bg-white text-stone-500 border border-stone-200/80'
                  }`}>
                    {pwdRequirements.hasUppercase ? <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0 stroke-[3]" /> : <div className="w-3.5 h-3.5 rounded-full border border-stone-300 shrink-0" />}
                    <span>حرف كبير (A-Z)</span>
                  </div>

                  <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] transition-colors ${
                    pwdRequirements.hasLowercase ? 'bg-emerald-100/80 text-emerald-800 font-bold' : 'bg-white text-stone-500 border border-stone-200/80'
                  }`}>
                    {pwdRequirements.hasLowercase ? <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0 stroke-[3]" /> : <div className="w-3.5 h-3.5 rounded-full border border-stone-300 shrink-0" />}
                    <span>حرف صغير (a-z)</span>
                  </div>

                  <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] transition-colors ${
                    pwdRequirements.hasNumber ? 'bg-emerald-100/80 text-emerald-800 font-bold' : 'bg-white text-stone-500 border border-stone-200/80'
                  }`}>
                    {pwdRequirements.hasNumber ? <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0 stroke-[3]" /> : <div className="w-3.5 h-3.5 rounded-full border border-stone-300 shrink-0" />}
                    <span>رقم واحد (0-9)</span>
                  </div>

                  <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] col-span-2 sm:col-span-1 transition-colors ${
                    pwdRequirements.hasSymbol ? 'bg-emerald-100/80 text-emerald-800 font-bold' : 'bg-white text-stone-500 border border-stone-200/80'
                  }`}>
                    {pwdRequirements.hasSymbol ? <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0 stroke-[3]" /> : <div className="w-3.5 h-3.5 rounded-full border border-stone-300 shrink-0" />}
                    <span>رمز خاص (@#$!)</span>
                  </div>
                </div>

                {confirmPassword.length > 0 && (
                  <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border font-bold transition-all mt-1 ${
                    confirmPassword === password
                      ? 'bg-emerald-100/80 border-emerald-300 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-600'
                  }`}>
                    {confirmPassword === password ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span>كلمتا المرور متطابقتان تماماً</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                        <span>كلمتا المرور غير متطابقتين</span>
                      </>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* Terms and Trust Notice */}
            <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/80 flex items-start gap-3 text-stone-600">
              <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">
                بالتسجيل، أنت توافق على شروط الاستخدام وسياسة الخصوصية لمنصة BricojobDz. بياناتك محمية ويتم التحقق من الحرفيين لضمان أمان وموثوقية المعاملات.
              </p>
            </div>

            {/* Terms and Conditions Checkbox */}
            <div id="field-terms" className={`p-4 rounded-2xl border transition-colors ${
              termsError ? 'bg-rose-50/40 border-rose-300' : 'bg-stone-50 border-stone-200/80'
            }`}>
              <div className="flex items-start gap-3">
                <div className="relative flex items-center mt-0.5">
                  <input
                    id="terms"
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => {
                      setAgreedToTerms(e.target.checked);
                      if (termsError && e.target.checked) setTermsError('');
                    }}
                    className="w-5 h-5 rounded-md border-2 border-stone-300 text-emerald-700 focus:ring-emerald-700/20 transition-all cursor-pointer accent-emerald-700"
                  />
                </div>
                <label htmlFor="terms" className="text-[11px] font-bold text-stone-600 leading-relaxed cursor-pointer select-none">
                  أوافق على <button type="button" className="text-emerald-700 hover:underline">شروط الاستخدام</button> و <button type="button" className="text-emerald-700 hover:underline">سياسة الخصوصية</button> الخاصة بمنصة BricojobDz.
                </label>
              </div>
              {termsError && (
                <p className="text-[11px] text-rose-600 font-bold mt-2 flex items-center gap-1 animate-fade-in pr-8">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{termsError}</span>
                </p>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold py-3.5 sm:py-4 rounded-2xl text-sm sm:text-base transition shadow-lg shadow-emerald-700/20 flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <span>جاري إنشاء الحساب...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>إنشاء الحساب</span>
                  </>
                )}
              </button>
            </div>

            {/* Link to Login only - Return to Home deleted */}
            <div className="text-center pt-4 border-t border-stone-200/80 text-xs sm:text-sm text-stone-600 font-medium">
              <p>
                لديك حساب بالفعل؟{' '}
                <button
                  type="button"
                  onClick={onNavigateToLogin}
                  className="text-emerald-700 font-extrabold hover:underline cursor-pointer"
                >
                  تسجيل الدخول
                </button>
              </p>
            </div>

          </form>

        </div>
      </main>

      {/* End of content */}
    </div>
  );
};


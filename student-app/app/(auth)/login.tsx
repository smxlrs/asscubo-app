import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  Pressable, 
  StyleSheet, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform, 
  TouchableWithoutFeedback, 
  Keyboard,
  Image,
  Alert,
  ScrollView
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase, translateAuthError } from '../../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [loginMode, setLoginMode] = useState<'password' | 'otp'>('password');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = React.useRef<any>(null);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const isSendDisabled = !email || countdown > 0 || sendingOtp;
  
  const { signIn } = useAuth();
  const { colors, t, language } = useTheme();
  const insets = useSafeAreaInsets();

  const handleSendOtp = async () => {
    if (!email) {
      setErrorMsg("请输入邮箱地址");
      return;
    }
    
    setErrorMsg(null);
    setSendingOtp(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: 'https://asscubo.it/verified.html',
        }
      });

      if (error) {
        if (error.message.includes('User not found') || error.message.includes('Signups not allowed')) {
          setErrorMsg("该邮箱未注册，请先注册账户");
        } else {
          setErrorMsg(translateAuthError(error.message, language));
        }
      } else {
        setOtpSent(true);
        Alert.alert("验证码已发送", "登录验证码已发送至您的邮箱，请注意查收。");
        setCountdown(60);
        timerRef.current = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              if (timerRef.current) clearInterval(timerRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (err: any) {
      console.error('Send OTP error:', err);
      setErrorMsg("网络错误，发送验证码失败");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleLogin = async () => {
    if (!agree) {
      Alert.alert(t('tip'), t('agreeAgreementPrompt'));
      return;
    }

    if (loginMode === 'password') {
      if (!email || !password) {
        setErrorMsg(t('enterEmailAndPassword'));
        return;
      }
      
      setErrorMsg(null);
      setLoading(true);
      
      try {
        const { error } = await signIn(email.trim(), password);
        if (error) {
          setErrorMsg(translateAuthError(error.message, language));
        } else {
          router.replace('/(tabs)');
        }
      } catch (err) {
        setErrorMsg(t('networkError'));
      } finally {
        setLoading(false);
      }
    } else {
      // OTP mode login
      if (!email || !otpCode) {
        setErrorMsg("请输入邮箱和验证码");
        return;
      }

      if (otpCode.length !== 6) {
        setErrorMsg("请输入完整的 6 位验证码");
        return;
      }

      setErrorMsg(null);
      setLoading(true);

      try {
        const { error } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: otpCode.trim(),
          type: 'email'
        });

        if (error) {
          setErrorMsg(translateAuthError(error.message, language));
        } else {
          router.replace('/(tabs)');
        }
      } catch (err) {
        setErrorMsg("网络错误，登录验证失败");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Fixed solid header to block Status Bar / Dynamic Island */}
      <View style={[styles.headerBar, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <Pressable 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)');
            }
          }}
          style={styles.backButton}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
        </Pressable>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.flex1}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 44 : 0}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.inner}>
              <View style={styles.header}>
                <Image 
                  source={require('../../assets/images/logo.png')} 
                  style={styles.logoImage} 
                  resizeMode="contain"
                />
                <Text style={[styles.title, { color: colors.textPrimary }]}>{t('appName')}</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('loginSubtitle')}</Text>
              </View>

              <View style={styles.form}>
                {errorMsg && (
                  <View style={[styles.errorContainer, { backgroundColor: colors.error + '15', borderColor: colors.error }]}>
                    <Text style={[styles.errorText, { color: colors.error }]}>{errorMsg}</Text>
                  </View>
                )}

                {/* Login Mode Selector */}
                <View style={[styles.tabSelector, { borderBottomColor: colors.border }]}>
                  <Pressable 
                    style={[styles.tabButton, loginMode === 'password' && { borderBottomColor: colors.primary }]}
                    onPress={() => {
                      setLoginMode('password');
                      setErrorMsg(null);
                    }}
                  >
                    <Text style={[
                      styles.tabButtonText, 
                      { color: loginMode === 'password' ? colors.primary : colors.textSecondary }
                    ]}>
                      密码登录
                    </Text>
                  </Pressable>

                  <Pressable 
                    style={[styles.tabButton, loginMode === 'otp' && { borderBottomColor: colors.primary }]}
                    onPress={() => {
                      setLoginMode('otp');
                      setErrorMsg(null);
                    }}
                  >
                    <Text style={[
                      styles.tabButtonText, 
                      { color: loginMode === 'otp' ? colors.primary : colors.textSecondary }
                    ]}>
                      验证码登录
                    </Text>
                  </Pressable>
                </View>

                {/* Email Field (Shared) */}
                <View style={styles.inputContainer}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('emailLabel')}</Text>
                  <TextInput 
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                    placeholder={t('emailPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                {/* Password Mode Fields */}
                {loginMode === 'password' && (
                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('passwordLabel')}</Text>
                    <TextInput 
                      style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                      placeholder={t('passwordPlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                  </View>
                )}

                {/* OTP Mode Fields */}
                {loginMode === 'otp' && (
                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>验证码</Text>
                    <View style={styles.otpInputRow}>
                      <TextInput 
                        style={[
                          styles.input, 
                          styles.otpCodeInput, 
                          { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }
                        ]}
                        placeholder="请输入 6 位验证码"
                        placeholderTextColor={colors.textMuted}
                        value={otpCode}
                        onChangeText={setOtpCode}
                        keyboardType="number-pad"
                        maxLength={6}
                        autoCapitalize="none"
                        editable={otpSent}
                      />
                      <Pressable 
                        style={[
                          styles.sendOtpButton, 
                          { backgroundColor: isSendDisabled ? colors.surfaceElevated : colors.primary },
                          isSendDisabled && { borderColor: colors.border }
                        ]}
                        onPress={handleSendOtp}
                        disabled={isSendDisabled}
                      >
                        {sendingOtp ? (
                          <ActivityIndicator color={isSendDisabled ? colors.textMuted : "#FFF"} size="small" />
                        ) : (
                          <Text style={[
                            styles.sendOtpButtonText, 
                            { color: isSendDisabled ? colors.textMuted : "#FFF" }
                          ]}>
                            {countdown > 0 ? `${countdown}s` : (otpSent ? "重新发送" : "获取验证码")}
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                )}

                <Pressable 
                  style={[styles.button, { backgroundColor: colors.primary }, loading && styles.buttonDisabled]} 
                  onPress={handleLogin}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.buttonText}>{t('loginButton')}</Text>
                  )}
                </Pressable>

                <View style={styles.agreementRow}>
                  <Pressable 
                    onPress={() => setAgree(!agree)} 
                    style={styles.checkboxContainer}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <MaterialCommunityIcons 
                      name={agree ? "checkbox-marked" : "checkbox-blank-outline"} 
                      size={18} 
                      color={agree ? colors.primary : colors.textMuted} 
                    />
                  </Pressable>
                  <Text style={[styles.agreementText, { color: colors.textSecondary }]}>
                    {t('agreementPrefix')}
                    <Text 
                      style={[styles.agreementLink, { color: colors.primaryLight }]} 
                      onPress={() => router.push('/about/terms')}
                    >
                      {t('userAgreementLabel')}
                    </Text>
                    {t('and')}
                    <Text 
                      style={[styles.agreementLink, { color: colors.primaryLight }]} 
                      onPress={() => router.push('/about/privacy')}
                    >
                      {t('privacyPolicyLabel')}
                    </Text>
                  </Text>
                </View>

                <View style={styles.footer}>
                  <Text style={[styles.footerText, { color: colors.textSecondary }]}>{t('noAccount')} </Text>
                  <Link href="/(auth)/register" asChild>
                    <Pressable>
                      <Text style={[styles.linkText, { color: colors.primaryLight }]}>{t('registerLink')}</Text>
                    </Pressable>
                  </Link>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  flex1: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  errorContainer: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 6,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  button: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
  },
  linkText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingHorizontal: 10,
  },
  checkboxContainer: {
    marginRight: 6,
  },
  agreementText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  agreementLink: {
    fontWeight: 'bold',
  },
  tabSelector: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginBottom: 24,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  otpInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  otpCodeInput: {
    flex: 1,
    marginRight: 12,
  },
  sendOtpButton: {
    width: 110,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  sendOtpButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});

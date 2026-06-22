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

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [resending, setResending] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const resendTimerRef = React.useRef<any>(null);

  React.useEffect(() => {
    return () => {
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    };
  }, []);

  const handleResendSignupEmail = async () => {
    if (!email) return;
    
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: {
          emailRedirectTo: Linking.createURL('login-callback')
        }
      });
      
      if (error) {
        Alert.alert("发送失败", translateAuthError(error.message, language));
      } else {
        Alert.alert("邮件已重送", "验证邮件已重新发送至您的邮箱，请注意查收。");
        setResendCountdown(60);
        resendTimerRef.current = setInterval(() => {
          setResendCountdown((prev) => {
            if (prev <= 1) {
              if (resendTimerRef.current) clearInterval(resendTimerRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (err) {
      console.error("Resend signup email error:", err);
      Alert.alert("发送失败", "网络发生错误，请稍后重试。");
    } finally {
      setResending(false);
    }
  };

  const { signUp } = useAuth();
  const { colors, t, language } = useTheme();
  const insets = useSafeAreaInsets();

  const handleRegister = async () => {
    if (!name || !email || !password) {
      setErrorMsg(t('fillRequiredFields'));
      return;
    }

    if (password.length < 6) {
      setErrorMsg(t('passwordTooShort'));
      return;
    }

    if (!agree) {
      Alert.alert(t('tip'), t('agreeAgreementPrompt'));
      return;
    }

    setErrorMsg(null);
    setLoading(true);

    try {
      const { error } = await signUp(email.trim(), password, name.trim());
      if (error) {
        setErrorMsg(translateAuthError(error.message, language));
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setErrorMsg(t('networkError'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={[styles.successContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.logoContainer, { backgroundColor: colors.primarySoft }]}>
          <MaterialCommunityIcons name="email-open-outline" size={44} color={colors.primary} />
        </View>
        <Text style={[styles.successTitle, { color: colors.textPrimary }]}>{t('successRegTitle')}</Text>
        <Text style={[styles.successText, { color: colors.textPrimary }]}>
          {t('successRegText')}
        </Text>
        <Text style={[styles.successSubtext, { color: colors.textSecondary }]}>
          {t('successRegSubtext')}
        </Text>

        <Pressable 
          style={[styles.resendButton, { borderColor: colors.border }, resendCountdown > 0 && { opacity: 0.6 }]}
          onPress={handleResendSignupEmail}
          disabled={resending || resendCountdown > 0}
        >
          {resending ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text style={[styles.resendButtonText, { color: colors.primary }]}>
              {resendCountdown > 0 ? `重新发送验证邮件 (${resendCountdown}s)` : "重新发送验证邮件"}
            </Text>
          )}
        </Pressable>

        <Link href="/(auth)/login" asChild>
          <Pressable style={[styles.successButton, { backgroundColor: colors.primary, marginTop: 12 }]}>
            <Text style={styles.successButtonText}>{t('backToLogin')}</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

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
                <Text style={[styles.title, { color: colors.textPrimary }]}>{t('registerLabel')}</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('appSubtitle')}</Text>
              </View>

              <View style={styles.form}>
                {errorMsg && (
                  <View style={[styles.errorContainer, { backgroundColor: colors.error + '15', borderColor: colors.error }]}>
                    <Text style={[styles.errorText, { color: colors.error }]}>{errorMsg}</Text>
                  </View>
                )}

                <View style={styles.inputContainer}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('nameLabel')}</Text>
                  <TextInput 
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                    placeholder={t('namePlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    value={name}
                    onChangeText={setName}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('emailLabel')}</Text>
                  <TextInput 
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                    placeholder={t('emailRegPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('passwordRegPlaceholder')}</Text>
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

                <Pressable 
                  style={[styles.button, { backgroundColor: colors.primary }, loading && styles.buttonDisabled]} 
                  onPress={handleRegister}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.buttonText}>{t('registerButton')}</Text>
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
                  <Text style={[styles.footerText, { color: colors.textSecondary }]}>{t('hasAccount')} </Text>
                  <Link href="/(auth)/login" asChild>
                    <Pressable>
                      <Text style={[styles.linkText, { color: colors.primaryLight }]}>{t('loginLink')}</Text>
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
    marginBottom: 16,
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
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoContainer: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  successText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  successSubtext: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 32,
  },
  successButton: {
    width: '100%',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resendButton: {
    width: '100%',
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  resendButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useStore } from '../store/useStore';

export default function AuthScreen() {
  const [view, setView]         = useState('login');   // login | register
  const [accountType, setAccountType] = useState('patient'); // patient | parent

  const [email, setEmail]       = useState('');
  const [password, setPass]     = useState('');
  const [nom, setNom]           = useState('');
  const [prenom, setPrenom]     = useState('');
  const [age, setAge]           = useState('');
  const [ville, setVille]       = useState('');
  const [phone, setPhone]       = useState('');
  const [doctorEmail, setDoctorEmail] = useState('');
  const [loading, setLoading]   = useState(false);
  const { setUserProfile }      = useStore();

  // ===== CONNEXION =====
  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Champs requis'); return; }
    setLoading(true);
    try {
      const cred = await auth().signInWithEmailAndPassword(email.trim(), password);
      const uid  = cred.user.uid;

      const snapP = await firestore().collection('patients').doc(uid).get();
      if (snapP.exists) {
        setUserProfile({ ...snapP.data(), role: 'patient' });
        return;
      }
      const snapPar = await firestore().collection('parents').doc(uid).get();
      if (snapPar.exists) {
        setUserProfile({ ...snapPar.data(), role: 'parent' });
        return;
      }
      Alert.alert('Erreur', 'Profil introuvable.');
    } catch (e) {
      const msg =
        e.code === 'auth/wrong-password'      ? 'Mot de passe incorrect'
      : e.code === 'auth/user-not-found'      ? 'Compte introuvable'
      : e.code === 'auth/invalid-credential'  ? 'Identifiants invalides'
      : e.code === 'auth/invalid-email'       ? 'Email invalide'
      : 'Erreur de connexion';
      Alert.alert('Erreur', msg);
    } finally { setLoading(false); }
  };

  // ===== INSCRIPTION PATIENT =====
  const handleRegisterPatient = async () => {
    if (!email || !password || !nom || !prenom) {
      Alert.alert('Champs requis', 'Nom, prénom, email et mot de passe obligatoires.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Mot de passe trop court', 'Minimum 6 caractères.'); return;
    }
    setLoading(true);
    try {
      const cred = await auth().createUserWithEmailAndPassword(email.trim(), password);
      const uid  = cred.user.uid;
      const profile = {
        uid,
        firstName:   prenom.trim(),
        lastName:    nom.trim(),
        age:         age.trim(),
        ville:       ville.trim(),
        email:       email.trim(),
        phone:       phone.trim(),
        doctorEmail: doctorEmail.trim(),
        role:        'patient',
        severity:    'Modere persistant',
        institution: 'ENSP Yaounde',
        createdAt:   firestore.FieldValue.serverTimestamp(),
      };
      await firestore().collection('patients').doc(uid).set(profile);

      // Annuaire minimal — permet a un parent/proche de retrouver ce
      // patient via son numero d'urgence (phone)
      await firestore().collection('lookups').doc(uid).set({
        uid,
        email: email.trim(),
        phone: phone.trim(),
        role:  'patient',
      });

      setUserProfile(profile);
    } catch (e) {
      const msg =
        e.code === 'auth/email-already-in-use' ? 'Email deja utilise'
      : e.code === 'auth/invalid-email'         ? 'Email invalide'
      : 'Erreur creation compte: ' + e.message;
      Alert.alert('Erreur', msg);
    } finally { setLoading(false); }
  };

  // ===== INSCRIPTION PARENT/PROCHE =====
  const handleRegisterParent = async () => {
    if (!email || !password || !nom || !prenom) {
      Alert.alert('Champs requis', 'Nom, prénom, email et mot de passe obligatoires.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Mot de passe trop court', 'Minimum 6 caractères.'); return;
    }
    setLoading(true);
    try {
      const cred = await auth().createUserWithEmailAndPassword(email.trim(), password);
      const uid  = cred.user.uid;

      // Lien automatique par numero de telephone (numero d'urgence du patient)
      let linkedPatientId = '';
      if (phone.trim()) {
        const snap = await firestore().collection('lookups')
          .where('phone', '==', phone.trim())
          .where('role', '==', 'patient')
          .limit(1).get();
        if (!snap.empty) {
          linkedPatientId = snap.docs[0].data().uid;
        } else {
          Alert.alert(
            'Patient introuvable',
            "Aucun patient n'a ce numero comme contact d'urgence. Vous pourrez le lier plus tard."
          );
        }
      }

      const profile = {
        uid,
        firstName:       prenom.trim(),
        lastName:        nom.trim(),
        email:           email.trim(),
        phone:           phone.trim(),
        role:            'parent',
        linkedPatientId: linkedPatientId,
        createdAt:       firestore.FieldValue.serverTimestamp(),
      };

      await firestore().collection('parents').doc(uid).set(profile);

      await firestore().collection('lookups').doc(uid).set({
        uid,
        email: email.trim(),
        phone: phone.trim(),
        role:  'parent',
      });

      if (linkedPatientId) {
        await firestore().collection('patients').doc(linkedPatientId).update({
          linkedParentId: uid,
          linkedParentName: `${prenom.trim()} ${nom.trim()}`,
        });
      }

      setUserProfile(profile);
    } catch (e) {
      const msg =
        e.code === 'auth/email-already-in-use' ? 'Email deja utilise'
      : e.code === 'auth/invalid-email'         ? 'Email invalide'
      : 'Erreur creation compte: ' + e.message;
      Alert.alert('Erreur', msg);
    } finally { setLoading(false); }
  };

  const handleSubmit = () => {
    if (view === 'login') return handleLogin();
    if (accountType === 'patient') return handleRegisterPatient();
    return handleRegisterParent();
  };

  // ===================== ECRAN CONNEXION =====================
  if (view === 'login') {
    return (
      <KeyboardAvoidingView style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
          <View style={styles.logoWrap}>
            <View style={styles.logoIcon}><Text style={styles.logoPlus}>+</Text></View>
            <Text style={styles.brandTitle}>ASTHMA MONITORING</Text>
            <Text style={styles.tagline}>Surveillez. Alertez. Agissez.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Se connecter</Text>

            <Field label="Email" value={email} onChangeText={setEmail}
              placeholder="votre@email.com" keyboard="email-address" />
            <Field label="Mot de passe" value={password} onChangeText={setPass}
              placeholder="••••••••" secure />

            <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.btnText}>SE CONNECTER</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setView('register')} style={styles.switchLink}>
              <Text style={styles.switchText}>
                Pas de compte ? <Text style={styles.switchTextAccent}>S'inscrire</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ===================== ECRAN INSCRIPTION =====================
  return (
    <KeyboardAvoidingView style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.registerTitle}>Creer un compte</Text>
        <Text style={styles.registerSub}>Rejoignez la communaute Asthma Monitoring</Text>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Type de compte</Text>
          <View style={styles.typeToggle}>
            <TouchableOpacity
              style={[styles.typeBtn, accountType==='patient' && styles.typeBtnActive]}
              onPress={() => setAccountType('patient')}>
              <Text style={[styles.typeBtnText, accountType==='patient' && styles.typeBtnTextActive]}>
                Patient
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeBtn, accountType==='parent' && styles.typeBtnActive]}
              onPress={() => setAccountType('parent')}>
              <Text style={[styles.typeBtnText, accountType==='parent' && styles.typeBtnTextActive]}>
                Parent/Proche
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <Field label="Nom" value={nom} onChangeText={setNom}
              placeholder="Essoung" style={{ flex:1, marginRight:8 }} />
            <Field label="Prenom" value={prenom} onChangeText={setPrenom}
              placeholder="Ines" style={{ flex:1 }} />
          </View>

          {accountType === 'patient' && (
            <View style={styles.row}>
              <Field label="Age" value={age} onChangeText={setAge}
                placeholder="25" keyboard="number-pad" style={{ flex:1, marginRight:8 }} />
              <Field label="Ville" value={ville} onChangeText={setVille}
                placeholder="Yaounde" style={{ flex:1 }} />
            </View>
          )}

          <Field label="Email" value={email} onChangeText={setEmail}
            placeholder="email@gmail.com" keyboard="email-address" />
          <Field label="Mot de passe" value={password} onChangeText={setPass}
            placeholder="••••••••" secure />

          {accountType === 'patient' ? (
            <>
              <Field label="Numero d'urgence (Parent)" value={phone}
                onChangeText={setPhone} placeholder="683271688" keyboard="phone-pad" />
              <Text style={styles.helperText}>
                Ce numero permettra a votre proche de suivre vos donnees
              </Text>
              <Field label="Email de votre medecin" value={doctorEmail}
                onChangeText={setDoctorEmail} placeholder="medecin@hopital.cm"
                keyboard="email-address" />
            </>
          ) : (
            <>
              <Field label="Votre numero de telephone" value={phone}
                onChangeText={setPhone} placeholder="683271688" keyboard="phone-pad" />
              <Text style={styles.helperText}>
                Ce numero doit correspondre au numero d'urgence du patient
              </Text>
            </>
          )}

          <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.btnText}>
                  {accountType==='patient' ? "S'INSCRIRE" : 'SE CONNECTER A MON PROCHE'}
                </Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setView('login')} style={styles.switchLink}>
            <Text style={styles.switchText}>
              Deja un compte ? <Text style={styles.switchTextAccent}>Se connecter</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboard, secure, style }) {
  const [show, setShow] = useState(false);
  return (
    <View style={[fieldStyles.wrap, style]}>
      <Text style={fieldStyles.label}>{label}</Text>
      <View style={fieldStyles.inputRow}>
        <TextInput
          style={fieldStyles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9aa8b8"
          keyboardType={keyboard || 'default'}
          secureTextEntry={secure && !show}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {secure && (
          <TouchableOpacity onPress={() => setShow(s => !s)}>
            <Text style={fieldStyles.voir}>{show ? 'Cacher' : 'Voir'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const GREEN = '#00c896';

const fieldStyles = StyleSheet.create({
  wrap:  { marginBottom: 14 },
  label: { fontSize:12, color:'#3a4a5c', fontWeight:'600', marginBottom:6 },
  inputRow: { flexDirection:'row', alignItems:'center',
    backgroundColor:'#f1f4f8', borderRadius:10, paddingHorizontal:14 },
  input: { flex:1, paddingVertical:12, fontSize:15, color:'#16242f' },
  voir:  { color:GREEN, fontWeight:'700', fontSize:13, marginLeft:8 },
});

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#eef2f7' },
  inner:     { padding:24, paddingTop:56, paddingBottom:40 },

  logoWrap:  { alignItems:'center', marginBottom:24 },
  logoIcon:  { width:64, height:64, borderRadius:18, backgroundColor:GREEN,
    alignItems:'center', justifyContent:'center', marginBottom:14 },
  logoPlus:  { fontSize:32, color:'#fff', fontWeight:'300' },
  brandTitle:{ fontSize:20, fontWeight:'900', color:'#16242f', letterSpacing:1 },
  tagline:   { fontSize:13, color:'#50657a', fontStyle:'italic', marginTop:6 },

  registerTitle: { fontSize:24, fontWeight:'900', color:'#16242f', marginBottom:4 },
  registerSub:   { fontSize:13, color:'#50657a', marginBottom:20 },

  card: { backgroundColor:'#fff', borderRadius:18, padding:20,
    shadowColor:'#000', shadowOpacity:0.06, shadowRadius:12, shadowOffset:{width:0,height:4},
    elevation:2 },
  cardTitle: { fontSize:19, fontWeight:'800', color:'#16242f', marginBottom:18 },

  fieldLabel: { fontSize:12, color:'#3a4a5c', fontWeight:'600', marginBottom:8 },
  typeToggle: { flexDirection:'row', backgroundColor:'#f1f4f8', borderRadius:10,
    padding:4, marginBottom:16 },
  typeBtn:    { flex:1, paddingVertical:10, borderRadius:8, alignItems:'center' },
  typeBtnActive: { backgroundColor:GREEN },
  typeBtnText: { fontSize:13, fontWeight:'700', color:'#50657a' },
  typeBtnTextActive: { color:'#fff' },

  row: { flexDirection:'row' },

  helperText: { fontSize:11, color:'#8394a5', marginTop:-8, marginBottom:14, lineHeight:16 },

  btn: { backgroundColor:GREEN, borderRadius:12, paddingVertical:15,
    alignItems:'center', marginTop:6 },
  btnDisabled: { opacity:0.6 },
  btnText: { color:'#fff', fontWeight:'800', fontSize:14, letterSpacing:0.5 },

  switchLink: { alignItems:'center', marginTop:16 },
  switchText: { fontSize:13, color:'#50657a' },
  switchTextAccent: { color:GREEN, fontWeight:'700' },
});
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Modal } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Copy, RefreshCw, Check, ChevronUp, ChevronDown } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useVaultStore } from '../../store/useVaultStore';
import { generateAdvancedPassword, generatePassphrase, generateUsername } from '../../services/cryptoService';
import { PasswordStrength } from '../../components/PasswordStrength';

export default function GeneratorScreen() {
  const router = useRouter();
  const { setDraftPassword, setDraftUsername } = useVaultStore();

  type GeneratorMode = 'password' | 'passphrase' | 'username';
  const [mode, setMode] = useState<GeneratorMode>('password');

  const [password, setPassword] = useState('');
  
  // Password State
  const [lengthStr, setLengthStr] = useState('12');
  const [useUppercase, setUseUppercase] = useState(true);
  const [useLowercase, setUseLowercase] = useState(true);
  const [useNumbers, setUseNumbers] = useState(false);
  const [useSymbols, setUseSymbols] = useState(false);
  const [minNumbers, setMinNumbers] = useState(1);
  const [minSymbols, setMinSymbols] = useState(1);
  const [avoidAmbiguous, setAvoidAmbiguous] = useState(false);

  // Passphrase State
  const [wordsCountStr, setWordsCountStr] = useState('6');
  const [wordSeparator, setWordSeparator] = useState('-');
  const [capitalizeWords, setCapitalizeWords] = useState(false);
  const [includeNumberInPassphrase, setIncludeNumberInPassphrase] = useState(false);

  // Username State
  type UsernameType = 'string' | 'catchall' | 'plus';
  const [usernameType, setUsernameType] = useState<UsernameType>('string');
  const [unameStringLength, setUnameStringLength] = useState('8');
  const [unameExactWordLength, setUnameExactWordLength] = useState('');
  const [unameCapitalize, setUnameCapitalize] = useState(true);
  const [unameIncludeNumber, setUnameIncludeNumber] = useState(true);
  const [unameDomain, setUnameDomain] = useState('gmail.com');
  const [unameEmail, setUnameEmail] = useState('');
  const [unameUseUppercase, setUnameUseUppercase] = useState(true);
  const [unameUseLowercase, setUnameUseLowercase] = useState(true);
  const [unameUseNumbers, setUnameUseNumbers] = useState(true);
  const [unameUseSymbols, setUnameUseSymbols] = useState(false);
  const [unameMinNumbers, setUnameMinNumbers] = useState(1);
  const [unameMinSymbols, setUnameMinSymbols] = useState(1);
  const [unameAvoidAmbiguous, setUnameAvoidAmbiguous] = useState(true);

  const calculatedMinLength = Math.max(
    5,
    (useNumbers ? minNumbers : 0) + 
    (useSymbols ? minSymbols : 0) + 
    (useUppercase ? 1 : 0) + 
    (useLowercase ? 1 : 0)
  );

  const generate = () => {
    if (mode === 'password') {
      let parsedLength = parseInt(lengthStr, 10);
      if (isNaN(parsedLength)) parsedLength = calculatedMinLength;
      
      if (parsedLength < calculatedMinLength) parsedLength = calculatedMinLength;
      if (parsedLength > 128) parsedLength = 128;
      
      setLengthStr(parsedLength.toString());

      const newPwd = generateAdvancedPassword({
        length: parsedLength,
        useUppercase,
        useLowercase,
        useNumbers,
        useSymbols,
        minNumbers: useNumbers ? minNumbers : 0,
        minSymbols: useSymbols ? minSymbols : 0,
        avoidAmbiguous
      });
      setPassword(newPwd);
    } else if (mode === 'passphrase') {
      let numWords = parseInt(wordsCountStr, 10);
      if (isNaN(numWords) || numWords < 3) numWords = 3;
      if (numWords > 20) numWords = 20;
      setWordsCountStr(numWords.toString());

      const newPhrase = generatePassphrase({
        wordsCount: numWords,
        separator: wordSeparator,
        capitalize: capitalizeWords,
        includeNumber: includeNumberInPassphrase
      });
      setPassword(newPhrase);
    } else if (mode === 'username') {
      let unameLen = parseInt(unameStringLength, 10);
      if (isNaN(unameLen)) unameLen = 8;
      
      const calculatedUnameMinLength = Math.max(
        1,
        (unameUseNumbers ? unameMinNumbers : 0) + 
        (unameUseSymbols ? unameMinSymbols : 0) + 
        (unameUseUppercase ? 1 : 0) + 
        (unameUseLowercase ? 1 : 0)
      );

      if (unameLen < calculatedUnameMinLength) unameLen = calculatedUnameMinLength;
      if (unameLen > 128) unameLen = 128;
      setUnameStringLength(unameLen.toString());

      let exactWordLen = parseInt(unameExactWordLength, 10);
      
      const newUname = generateUsername({
        type: usernameType,
        length: unameLen,
        wordLength: isNaN(exactWordLen) ? undefined : exactWordLen,
        capitalize: unameCapitalize,
        includeNumber: unameIncludeNumber,
        domainName: unameDomain,
        emailAddress: unameEmail,
        useUppercase: unameUseUppercase,
        useLowercase: unameUseLowercase,
        useNumbers: unameUseNumbers,
        useSymbols: unameUseSymbols,
        minNumbers: unameUseNumbers ? unameMinNumbers : 0,
        minSymbols: unameUseSymbols ? unameMinSymbols : 0,
        avoidAmbiguous: unameAvoidAmbiguous
      });
      setPassword(newUname);
    }
  };

  const copyToClipboard = async () => {
    if (password) {
      await Clipboard.setStringAsync(password);
      setTimeout(async () => {
        const current = await Clipboard.getStringAsync();
        if (current === password) await Clipboard.setStringAsync('');
      }, 30000);
    }
  };

  const handleToggle = (type: 'upper' | 'lower' | 'num' | 'sym') => {
    let newU = useUppercase;
    let newL = useLowercase;
    let newN = useNumbers;
    let newS = useSymbols;
    
    if (type === 'upper') newU = !newU;
    if (type === 'lower') newL = !newL;
    if (type === 'num') newN = !newN;
    if (type === 'sym') newS = !newS;

    if (!newU && !newL && !newN && !newS) {
      newU = true;
      newL = true;
    }

    setUseUppercase(newU);
    setUseLowercase(newL);
    setUseNumbers(newN);
    setUseSymbols(newS);
  };

  const handleUnameToggle = (type: 'upper' | 'lower' | 'num' | 'sym') => {
    let newU = unameUseUppercase;
    let newL = unameUseLowercase;
    let newN = unameUseNumbers;
    let newS = unameUseSymbols;
    
    if (type === 'upper') newU = !newU;
    if (type === 'lower') newL = !newL;
    if (type === 'num') newN = !newN;
    if (type === 'sym') newS = !newS;

    if (!newU && !newL && !newN && !newS) {
      newU = true;
      newL = true;
    }

    setUnameUseUppercase(newU);
    setUnameUseLowercase(newL);
    setUnameUseNumbers(newN);
    setUnameUseSymbols(newS);
  };

  const handleCreateLogin = () => {
    if (!password) return;
    if (mode === 'username') {
      setDraftUsername(password);
    } else {
      setDraftPassword(password);
    }
    router.navigate('/(tabs)');
  };

  // Generate on mount or options change (but not on text input change)
  useEffect(() => {
    generate();
  }, [
    mode, 
    usernameType,
    // Password toggles
    useUppercase,
    useLowercase,
    useNumbers,
    useSymbols,
    minNumbers,
    minSymbols,
    avoidAmbiguous,
    // Passphrase toggles
    capitalizeWords,
    includeNumberInPassphrase,
    // Username toggles
    unameCapitalize,
    unameIncludeNumber,
    unameUseUppercase,
    unameUseLowercase,
    unameUseNumbers,
    unameUseSymbols,
    unameMinNumbers,
    unameMinSymbols,
    unameAvoidAmbiguous
  ]);

  return (
    <View className="flex-1 bg-zinc-950 p-6">
      
      {/* Segmented Control */}
      <View className="flex-row bg-zinc-900 border border-zinc-800 rounded-full p-1 mb-6">
        <TouchableOpacity 
          className={`flex-1 py-3 items-center rounded-full ${mode === 'password' ? 'bg-blue-100' : 'bg-transparent'}`}
          onPress={() => setMode('password')}
        >
          <Text className={`font-semibold ${mode === 'password' ? 'text-blue-900' : 'text-zinc-400'}`}>Password</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          className={`flex-1 py-3 items-center rounded-full ${mode === 'passphrase' ? 'bg-blue-100' : 'bg-transparent'}`}
          onPress={() => setMode('passphrase')}
        >
          <Text className={`font-semibold ${mode === 'passphrase' ? 'text-blue-900' : 'text-zinc-400'}`}>Passphrase</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          className={`flex-1 py-3 items-center rounded-full ${mode === 'username' ? 'bg-blue-100' : 'bg-transparent'}`}
          onPress={() => setMode('username')}
        >
          <Text className={`font-semibold ${mode === 'username' ? 'text-blue-900' : 'text-zinc-400'}`}>Username</Text>
        </TouchableOpacity>
      </View>

      {/* Result Display */}
      <View className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 items-center mb-6 relative">
        <Text className="text-white text-3xl font-mono text-center tracking-widest mb-4">
          {password || 'Select options'}
        </Text>
        <PasswordStrength password={password} />
        
        <View className="flex-row mt-6 space-x-4 gap-4">
          <TouchableOpacity onPress={generate} className="bg-zinc-800 p-3 rounded-xl flex-row items-center">
            <RefreshCw color="#FFF" size={20} />
            <Text className="text-white ml-2 font-semibold">Regenerate</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={copyToClipboard} className="bg-zinc-800 p-3 rounded-xl flex-row items-center">
            <Copy color="#FFF" size={20} />
            <Text className="text-white ml-2 font-semibold">Copy</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row space-x-4 gap-4 mt-6">
        <TouchableOpacity 
          className="flex-1 bg-zinc-900 p-4 rounded-xl items-center border border-zinc-800"
          onPress={handleCreateLogin}
        >
          <Text className="text-white font-semibold">{mode === 'username' ? 'Create with Username' : 'Create Login'}</Text>
        </TouchableOpacity>
      </View>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-white font-bold text-xl mb-4">Options</Text>

        {mode === 'password' && (
          <>
            <View className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 mb-4">
              <Text className="text-white font-semibold text-base mb-3">Length</Text>
              <TextInput 
                className="bg-zinc-950 border border-zinc-800 text-white p-4 rounded-xl text-lg font-semibold"
                keyboardType="numeric"
                value={lengthStr}
                onChangeText={setLengthStr}
                autoCapitalize="none"
              />
              <Text className="text-zinc-500 text-xs mt-3">Value must be between {calculatedMinLength} and 128. Use 14 characters or more to generate a strong password.</Text>
            </View>

            <View className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 mb-4">
              <View className="flex-row flex-wrap">
                <CustomCheckbox label="A-Z" checked={useUppercase} onPress={() => handleToggle('upper')} />
                <CustomCheckbox label="a-z" checked={useLowercase} onPress={() => handleToggle('lower')} />
                <CustomCheckbox label="0-9" checked={useNumbers} onPress={() => handleToggle('num')} />
                <CustomCheckbox label="!@#$%^&*" checked={useSymbols} onPress={() => handleToggle('sym')} />
              </View>
              
              <View className="flex-row mt-4 space-x-4 gap-4">
                <View className="flex-1">
                  <Text className="text-white font-semibold text-sm mb-2">Minimum numbers</Text>
                  <NumericStepper value={minNumbers} onChange={setMinNumbers} disabled={!useNumbers} />
                </View>
                <View className="flex-1">
                  <Text className="text-white font-semibold text-sm mb-2">Minimum special</Text>
                  <NumericStepper value={minSymbols} onChange={setMinSymbols} disabled={!useSymbols} />
                </View>
              </View>

              <View className="mt-6">
                <CustomCheckbox label="Avoid ambiguous characters" checked={avoidAmbiguous} onPress={() => setAvoidAmbiguous(!avoidAmbiguous)} />
              </View>
            </View>
          </>
        )}

        {mode === 'passphrase' && (
          <>
            <View className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 mb-4">
              <Text className="text-white font-semibold text-base mb-3">Number of words</Text>
              <TextInput 
                className="bg-zinc-950 border border-zinc-800 text-white p-4 rounded-xl text-lg font-semibold"
                keyboardType="numeric"
                value={wordsCountStr}
                onChangeText={setWordsCountStr}
                autoCapitalize="none"
              />
              <Text className="text-zinc-500 text-xs mt-3">Value must be between 3 and 20. Use 6 words or more to generate a strong passphrase.</Text>
            </View>

            <View className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 mb-4">
              <Text className="text-white font-semibold text-base mb-3">Word separator</Text>
              <TextInput 
                className="bg-zinc-950 border border-zinc-800 text-white p-4 rounded-xl text-lg font-semibold mb-6"
                value={wordSeparator}
                onChangeText={setWordSeparator}
                autoCapitalize="none"
              />
              
              <CustomCheckbox label="Capitalize" checked={capitalizeWords} onPress={() => setCapitalizeWords(!capitalizeWords)} />
              <CustomCheckbox label="Include number" checked={includeNumberInPassphrase} onPress={() => setIncludeNumberInPassphrase(!includeNumberInPassphrase)} />
            </View>
          </>
        )}

        {mode === 'username' && (
          <>
            <View className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 mb-4">
              <Text className="text-white font-semibold text-base mb-4">Type</Text>
              
              <View className="mb-6 z-10 relative">
                <Dropdown 
                  options={[
                    { label: 'Random string', value: 'string' },
                    { label: 'Catch-all email', value: 'catchall', description: "Use your domain's configured catch-all inbox." },
                    { label: 'Plus addressed email', value: 'plus', description: "Use your email provider's sub-addressing capabilities." }
                  ]}
                  selected={usernameType}
                  onSelect={(v) => setUsernameType(v as UsernameType)}
                />
              </View>

              {usernameType === 'string' && (
                <View>
                  <Text className="text-white font-semibold text-sm mb-3 ml-1">Length</Text>
                  <TextInput 
                    className="bg-zinc-950 border border-zinc-800 text-white p-4 rounded-xl text-base font-semibold mb-6"
                    keyboardType="numeric"
                    value={unameStringLength}
                    onChangeText={setUnameStringLength}
                    autoCapitalize="none"
                  />

                  <View className="flex-row flex-wrap">
                    <CustomCheckbox label="A-Z" checked={unameUseUppercase} onPress={() => handleUnameToggle('upper')} />
                    <CustomCheckbox label="a-z" checked={unameUseLowercase} onPress={() => handleUnameToggle('lower')} />
                    <CustomCheckbox label="0-9" checked={unameUseNumbers} onPress={() => handleUnameToggle('num')} />
                    <CustomCheckbox label="!@#$%^&*" checked={unameUseSymbols} onPress={() => handleUnameToggle('sym')} />
                  </View>
                  
                  <View className="flex-row mt-4 space-x-4 gap-4">
                    <View className="flex-1">
                      <Text className="text-white font-semibold text-sm mb-2">Minimum numbers</Text>
                      <NumericStepper value={unameMinNumbers} onChange={setUnameMinNumbers} disabled={!unameUseNumbers} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-semibold text-sm mb-2">Minimum special</Text>
                      <NumericStepper value={unameMinSymbols} onChange={setUnameMinSymbols} disabled={!unameUseSymbols} />
                    </View>
                  </View>

                  <View className="mt-6">
                    <CustomCheckbox label="Avoid ambiguous characters" checked={unameAvoidAmbiguous} onPress={() => setUnameAvoidAmbiguous(!unameAvoidAmbiguous)} />
                  </View>
                </View>
              )}

              {usernameType === 'catchall' && (
                <View>
                  <Text className="text-white font-semibold text-sm mb-3 ml-1">Domain name</Text>
                  <TextInput 
                    className="bg-zinc-950 border border-zinc-800 text-white p-4 rounded-xl text-base font-semibold"
                    value={unameDomain}
                    onChangeText={setUnameDomain}
                    placeholder="example.com"
                    placeholderTextColor="#52525B"
                    autoCapitalize="none"
                  />
                </View>
              )}

              {usernameType === 'plus' && (
                <View>
                  <Text className="text-white font-semibold text-sm mb-3 ml-1">Email</Text>
                  <TextInput 
                    className="bg-zinc-950 border border-zinc-800 text-white p-4 rounded-xl text-base font-semibold"
                    value={unameEmail}
                    onChangeText={setUnameEmail}
                    placeholder="your@email.com"
                    placeholderTextColor="#52525B"
                    autoCapitalize="none"
                  />
                </View>
              )}

            </View>
          </>
        )}

      </ScrollView>
    </View>
  );
}

function CustomCheckbox({ label, checked, onPress }: { label: string, checked: boolean, onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} className="flex-row items-center mr-6 mb-2" activeOpacity={0.7}>
      <View className={`w-5 h-5 rounded mr-3 items-center justify-center border ${checked ? 'bg-blue-500 border-blue-500' : 'border-zinc-600 bg-zinc-950'}`}>
        {checked && <Check size={14} color="#FFF" strokeWidth={3} />}
      </View>
      <Text className="text-white font-semibold text-base">{label}</Text>
    </TouchableOpacity>
  );
}

function NumericStepper({ value, onChange, disabled }: { value: number, onChange: (v: number) => void, disabled: boolean }) {
  return (
    <View className={`flex-row items-center justify-between bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 ${disabled ? 'opacity-50' : ''}`}>
      <Text className="text-white font-semibold text-lg">{value}</Text>
      <View>
        <TouchableOpacity onPress={() => !disabled && onChange(value + 1)} className="mb-1 p-1 bg-zinc-900 rounded" disabled={disabled}>
          <ChevronUp size={14} color="#9CA3AF" strokeWidth={3} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => !disabled && onChange(Math.max(0, value - 1))} className="p-1 bg-zinc-900 rounded" disabled={disabled}>
          <ChevronDown size={14} color="#9CA3AF" strokeWidth={3} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Dropdown({ options, selected, onSelect }: { 
  options: { label: string, value: string, description?: string }[], 
  selected: string, 
  onSelect: (v: string) => void 
}) {
  const [open, setOpen] = useState(false);
  
  const selectedOption = options.find(o => o.value === selected);
  
  return (
    <>
      <TouchableOpacity 
        className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex-row justify-between items-center"
        onPress={() => setOpen(true)}
      >
        <Text className="text-white font-semibold">{selectedOption?.label}</Text>
        <ChevronDown size={20} color="#9CA3AF" />
      </TouchableOpacity>
      
      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity className="flex-1 bg-black/50 justify-center p-6" onPress={() => setOpen(false)} activeOpacity={1}>
          <View className="bg-zinc-900 rounded-2xl border border-zinc-700 overflow-hidden">
            {options.map((opt, idx) => (
              <TouchableOpacity 
                key={opt.value}
                className={`p-5 ${idx < options.length - 1 ? 'border-b border-zinc-800' : ''} ${selected === opt.value ? 'bg-blue-500/20' : ''}`}
                onPress={() => {
                  onSelect(opt.value);
                  setOpen(false);
                }}
              >
                <Text className={`font-semibold ${selected === opt.value ? 'text-blue-500' : 'text-white'}`}>{opt.label}</Text>
                {opt.description && <Text className="text-zinc-500 text-xs mt-1">{opt.description}</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

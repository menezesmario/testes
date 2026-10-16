// FC por Bluetooth, tela acesa, bipes e vibração. Tudo tolera ausência:
// no iframe do Artifact a maior parte destas APIs não existe ou é bloqueada.

// ---------- FC por Bluetooth (perfil padrão Heart Rate, 0x180D) ----------
// Byte 0 são flags; o bit 0 diz se a FC vem em uint8 ou uint16 (little-endian).
export function lerMedidaFc(dataView) {
  const flags = dataView.getUint8(0);
  return flags & 0x01 ? dataView.getUint16(1, true) : dataView.getUint8(1);
}

export const AJUDA_BLUETOOTH = [
  "No relógio, ative o Heart Rate Push (procure por \"Heart Rate Push\" ou \"Transmitir FC\" na lista de apps ou nas configurações) e deixe essa tela aberta.",
  "No celular, deixe Bluetooth e Localização ligados e permita ao Chrome o acesso a \"Dispositivos por perto\".",
  "Toque em \"Procurar de novo\". Se o relógio não aparecer, use \"Mostrar todos os aparelhos\" e escolha o que tiver o nome dele (ex.: Amazfit GTR 4).",
  "Funciona só no Chrome do Android, com o app aberto fora do Claude.",
];

// O relógio pode anunciar só o nome, sem o serviço de FC no anúncio: aceita
// também pelo prefixo do nome. Os filtros do Web Bluetooth valem como "ou".
const FILTROS_FC = [{ services: ["heart_rate"] }, { namePrefix: "Amazfit" }, { namePrefix: "GTR" }, { namePrefix: "Zepp" }];

export class SemFcError extends Error {
  constructor(nome) {
    super(`${nome ?? "O aparelho"} conectou, mas não está transmitindo a FC.`);
    this.name = "SemFcError";
  }
}

export const fcBluetooth = {
  disponivel() {
    if (typeof navigator === "undefined" || !navigator.bluetooth) return false;
    try {
      const politica = document.permissionsPolicy ?? document.featurePolicy;
      if (politica?.allowsFeature && politica.allowsFeature("bluetooth") === false) return false;
    } catch {
      return false;
    }
    return true;
  },

  // onFc(bpm) a cada leitura; aoDesconectar() se o relógio cair.
  // todos: mostra qualquer aparelho por perto (para quando o relógio não aparece).
  async conectar(onFc, { aoDesconectar, todos = false } = {}) {
    if (!this.disponivel()) throw new Error("Bluetooth indisponível neste navegador");
    const aparelho = await navigator.bluetooth.requestDevice(
      todos
        ? { acceptAllDevices: true, optionalServices: ["heart_rate"] }
        : { filters: FILTROS_FC, optionalServices: ["heart_rate"] },
    );
    const servidor = await aparelho.gatt.connect();
    let medida;
    try {
      const servico = await servidor.getPrimaryService("heart_rate");
      medida = await servico.getCharacteristic("heart_rate_measurement");
    } catch {
      // Achado pelo nome, mas sem o serviço de FC: o Heart Rate Push está desligado.
      if (aparelho.gatt.connected) aparelho.gatt.disconnect();
      throw new SemFcError(aparelho.name);
    }
    const aoMudar = (e) => {
      const bpm = lerMedidaFc(e.target.value);
      if (bpm > 0) onFc(bpm);
    };
    let encerrado = false;
    const aoCair = () => {
      if (!encerrado) aoDesconectar?.();
    };
    medida.addEventListener("characteristicvaluechanged", aoMudar);
    aparelho.addEventListener("gattserverdisconnected", aoCair);
    await medida.startNotifications();
    return {
      nome: aparelho.name ?? "Relógio",
      async desconectar() {
        encerrado = true;
        medida.removeEventListener("characteristicvaluechanged", aoMudar);
        aparelho.removeEventListener("gattserverdisconnected", aoCair);
        try {
          await medida.stopNotifications();
        } catch { /* o relógio pode já ter caído */ }
        if (aparelho.gatt.connected) aparelho.gatt.disconnect();
      },
    };
  },
};

// ---------- Tela acesa ----------
// O navegador solta o wake lock quando a aba sai de vista; religamos ao voltar.
let trava = null;
let querAcesa = false;
let pedindo = null; // pedido em andamento: ligar e visibilitychange não pedem dois

function pedirTrava() {
  if (!querAcesa || trava || document.visibilityState !== "visible") return pedindo ?? Promise.resolve();
  pedindo ??= (async () => {
    try {
      const nova = await navigator.wakeLock?.request("screen");
      if (!nova) return;
      // desligar() pode ter rodado enquanto o pedido estava pendente.
      if (!querAcesa) {
        await nova.release().catch(() => {});
        return;
      }
      trava = nova;
      nova.addEventListener("release", () => { if (trava === nova) trava = null; });
    } catch {
      trava = null;
    } finally {
      pedindo = null;
    }
  })();
  return pedindo;
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") pedirTrava();
  });
}

export const telaAcesa = {
  disponivel: () => typeof navigator !== "undefined" && "wakeLock" in navigator,
  ligar() {
    querAcesa = true;
    return pedirTrava();
  },
  async desligar() {
    querAcesa = false;
    const atual = trava;
    trava = null;
    try {
      await atual?.release();
    } catch { /* já solta */ }
  },
  ativa: () => !!trava,
};

// ---------- Bipes ----------
// O AudioContext só toca depois de um gesto do usuário; main.js chama
// prepararAudio() no primeiro toque.
let audio = null;

export function prepararAudio() {
  try {
    const Contexto = window.AudioContext ?? window.webkitAudioContext;
    if (!Contexto) return;
    audio ??= new Contexto();
    if (audio.state === "suspended") audio.resume().catch(() => {});
  } catch {
    audio = null;
  }
}

function tom(inicio, duracao, freq) {
  const osc = audio.createOscillator();
  const ganho = audio.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  // Envelope curto evita o estalo no começo e no fim do bipe.
  ganho.gain.setValueAtTime(0.0001, inicio);
  ganho.gain.exponentialRampToValueAtTime(0.35, inicio + 0.012);
  ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + duracao);
  osc.connect(ganho).connect(audio.destination);
  osc.start(inicio);
  osc.stop(inicio + duracao + 0.02);
}

const PADROES_BIPE = {
  contagem: [[0, 0.09, 880]],
  troca: [[0, 0.14, 988], [0.2, 0.14, 1318]],
  fim: [[0, 0.16, 988], [0.24, 0.16, 988], [0.48, 0.3, 1318]],
  aviso: [[0, 0.07, 660]],
};

export function bipe(tipo = "contagem") {
  if (!audio) prepararAudio();
  if (!audio) return;
  try {
    if (audio.state === "suspended") audio.resume().catch(() => {});
    const agora = audio.currentTime + 0.01;
    for (const [atraso, duracao, freq] of PADROES_BIPE[tipo] ?? PADROES_BIPE.contagem) tom(agora + atraso, duracao, freq);
  } catch { /* som é acessório */ }
}

export function vibrar(padrao = 80) {
  try {
    navigator.vibrate?.(padrao);
  } catch { /* sem vibração no aparelho */ }
}

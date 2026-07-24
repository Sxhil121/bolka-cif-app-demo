"use client";

/**
 * The CIF-facing page.
 *
 * Two things happen in this file, and they are kept deliberately separate:
 *
 *   1. REAL Dynamics 365 Channel Integration Framework (CIF) 1.0 wiring:
 *      detecting/loading the ucilib script, listening for CIFInitDone,
 *      and registering an onclicktoact handler via
 *      Microsoft.CIFramework.addHandler. This part talks to genuine
 *      Microsoft APIs, per the official docs (see README.md References).
 *
 *   2. SIMULATED call lifecycle: ringing -> connected -> ended -> wrap-up.
 *      Nothing in this part calls any real telephony backend or writes to
 *      Dataverse. Every place a real integration would eventually plug in
 *      is marked with "// TODO: real integration — ...".
 */

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./dialpad.module.css";

const STATUS = {
  DETECTING: "detecting",
  LOADING: "loading",
  LIVE: "live",
  STANDALONE: "standalone",
  ERROR: "error",
};

const STATUS_LABEL = {
  [STATUS.DETECTING]: "Detecting…",
  [STATUS.LOADING]: "Loading CIF library…",
  [STATUS.LIVE]: "Connected (live)",
  [STATUS.STANDALONE]: "Standalone preview",
  [STATUS.ERROR]: "CIF error",
};

const CALL_STATE = {
  IDLE: "idle",
  RINGING: "ringing",
  CONNECTED: "connected",
  ENDED: "ended",
};

function formatTimer(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

let eventSeq = 0;
let callSeq = 0;

export default function DialpadClient() {
  const searchParams = useSearchParams();

  const [status, setStatus] = useState(STATUS.DETECTING);
  const [events, setEvents] = useState([]);
  const [callState, setCallState] = useState(CALL_STATE.IDLE);
  const [callMeta, setCallMeta] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loggedCalls, setLoggedCalls] = useState([]);
  const [dialValue, setDialValue] = useState("");
  const [disposition, setDisposition] = useState("Connected - Resolved");
  const [notes, setNotes] = useState("");

  // Refs mirror the values above for use inside timers/callbacks, which
  // would otherwise see stale values from the render they were created in.
  const cifReadyRef = useRef(false);
  const callStateRef = useRef(CALL_STATE.IDLE);
  const callMetaRef = useRef(null);
  const elapsedRef = useRef(0);
  const readyTimerRef = useRef(null);
  const ringingTimerRef = useRef(null);
  const tickTimerRef = useRef(null);
  const eventLogRef = useRef(null);

  function logEvent(kind, title, data) {
    eventSeq += 1;
    const entry = {
      id: eventSeq,
      kind,
      title,
      data,
      time: new Date().toLocaleTimeString(undefined, { hour12: false }),
    };
    setEvents((prev) => [...prev, entry]);
  }

  useEffect(() => {
    if (eventLogRef.current) {
      eventLogRef.current.scrollTop = eventLogRef.current.scrollHeight;
    }
  }, [events]);

  // ================================================================
  // PART 1 — REAL Dynamics 365 CIF wiring
  // ================================================================
  useEffect(() => {
    const ucilib = searchParams.get("ucilib");

    function enterStandalone(reason) {
      if (cifReadyRef.current) return; // CIF already connected — ignore late fallback
      if (readyTimerRef.current) {
        clearTimeout(readyTimerRef.current);
        readyTimerRef.current = null;
      }
      setStatus(STATUS.STANDALONE);
      logEvent("system", `Standalone preview mode: ${reason}`);
    }

    function enterError(reason) {
      setStatus(STATUS.ERROR);
      logEvent("error", `CIF error: ${reason}`);
      enterStandalone("falling back after error");
    }

    function registerHandlers() {
      if (typeof window.Microsoft === "undefined" || !window.Microsoft.CIFramework) {
        enterError("CIFInitDone fired but Microsoft.CIFramework is unavailable");
        return;
      }

      // Real CIF API call: subscribe to the built-in onclicktoact event.
      // eventData shape (per Microsoft docs):
      //   { value, name, format, entityLogicalName }
      window.Microsoft.CIFramework.addHandler("onclicktoact", function (eventData) {
        logEvent("cif", "onclicktoact received", eventData);
        startSimulatedCall({
          value: eventData && eventData.value,
          name: (eventData && eventData.name) || "unknown",
          format: (eventData && eventData.format) || "phone",
          entityLogicalName: (eventData && eventData.entityLogicalName) || "unknown",
        });
        return Promise.resolve();
      });

      logEvent("cif", "Registered handler for onclicktoact via Microsoft.CIFramework.addHandler");

      // Reference only — not invoked in this demo. Each of these is a real
      // Microsoft.CIFramework method per the API reference; wiring any of
      // them up is future work, not part of this simulation.
      //
      // Microsoft.CIFramework.getEnvironment().then(...)
      // Microsoft.CIFramework.setWidth("400px");
      // Microsoft.CIFramework.getWidth().then(...);
      // Microsoft.CIFramework.setMode(0 /* Vertical */ | 1 /* Horizontal */);
      // Microsoft.CIFramework.getMode().then(...);
      // Microsoft.CIFramework.searchAndOpenRecords("contact", "9833165547");
      // Microsoft.CIFramework.openForm({ entityName: "phonecall" });
      // Microsoft.CIFramework.renderSearchPage("contact", true);
      // Microsoft.CIFramework.removeHandler("onclicktoact", myHandler);
      // Microsoft.CIFramework.raiseEvent("myCustomEvent", { foo: "bar" });
      // Microsoft.CIFramework.updateContext();
      //
      // TODO: real integration — once wrap-up is confirmed, this is where
      // Microsoft.CIFframework.createRecord('phonecall', {...}) would write
      // the call activity directly into Dataverse from this app, as an
      // alternative to (or in addition to) a Bolka backend call. All API
      // calls are subject to a 10-second timeout per Microsoft's docs.
    }

    function startLoadingCifLibrary() {
      setStatus(STATUS.LOADING);
      logEvent("system", "ucilib parameter found, injecting CIF library script", { ucilib });
    }

    function announceNoUcilib() {
      logEvent("system", "No ucilib parameter in URL — not hosted inside a Dynamics CIF panel");
      enterStandalone("no ucilib parameter present");
    }

    function onCifInitDone() {
      cifReadyRef.current = true;
      if (readyTimerRef.current) {
        clearTimeout(readyTimerRef.current);
        readyTimerRef.current = null;
      }
      setStatus(STATUS.LIVE);
      logEvent("cif", "CIFInitDone received — Microsoft.CIFramework APIs are now safe to call");
      registerHandlers();
    }

    window.addEventListener("CIFInitDone", onCifInitDone);

    let script = null;
    if (ucilib) {
      startLoadingCifLibrary();

      script = document.createElement("script");
      script.src = ucilib;
      script.async = true;
      script.onload = function () {
        logEvent("system", "CIF library script loaded (msdyn_ciLibrary.js). Waiting for CIFInitDone…");
      };
      script.onerror = function () {
        enterError("failed to load script from ucilib URL");
      };
      document.head.appendChild(script);

      // Dynamics never confirms readiness within ~6s -> fall back to standalone.
      readyTimerRef.current = setTimeout(function () {
        enterError("CIFInitDone did not fire within 6s timeout");
      }, 6000);
    } else {
      announceNoUcilib();
    }

    return function cleanup() {
      window.removeEventListener("CIFInitDone", onCifInitDone);
      if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
      if (script && script.parentNode) script.parentNode.removeChild(script);
    };
    // Intentionally runs once on mount — ucilib is read from the initial
    // URL only, matching how Dynamics loads this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ================================================================
  // PART 2 — SIMULATED call lifecycle (no real telephony, ever)
  // ================================================================

  function startSimulatedCall(eventData) {
    if (callStateRef.current !== CALL_STATE.IDLE) {
      logEvent("system", "Ignored new call — one is already in progress");
      return;
    }

    callSeq += 1;
    const meta = {
      id: `sim-${Date.now()}-${callSeq}`,
      value: eventData.value,
      name: eventData.name,
      format: eventData.format,
      entityLogicalName: eventData.entityLogicalName,
      startedAt: new Date(),
    };

    callMetaRef.current = meta;
    callStateRef.current = CALL_STATE.RINGING;
    elapsedRef.current = 0;

    setCallMeta(meta);
    setCallState(CALL_STATE.RINGING);
    setElapsedSeconds(0);

    logEvent("call", "Simulated call: ringing", meta);

    // TODO: real integration — this is where a real Bolka backend call
    // would originate the call, e.g. POST /calls/originate with the
    // number/entity context. Here we just fake a short ring delay.
    const ringDelay = 1000 + Math.random() * 500; // ~1.0-1.5s
    ringingTimerRef.current = setTimeout(function () {
      if (callStateRef.current !== CALL_STATE.RINGING) return;
      transitionToConnected();
    }, ringDelay);
  }

  function transitionToConnected() {
    callStateRef.current = CALL_STATE.CONNECTED;
    setCallState(CALL_STATE.CONNECTED);
    logEvent("call", "Simulated call: connected", { id: callMetaRef.current.id });

    tickTimerRef.current = setInterval(function () {
      elapsedRef.current += 1;
      setElapsedSeconds(elapsedRef.current);
    }, 1000);
  }

  function endCall() {
    if (callStateRef.current === CALL_STATE.IDLE) return;

    if (ringingTimerRef.current) {
      clearTimeout(ringingTimerRef.current);
      ringingTimerRef.current = null;
    }
    if (tickTimerRef.current) {
      clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }

    const wasConnected = callStateRef.current === CALL_STATE.CONNECTED;
    callStateRef.current = CALL_STATE.ENDED;
    setCallState(CALL_STATE.ENDED);

    logEvent("call", "Simulated call: ended", {
      id: callMetaRef.current.id,
      durationSeconds: wasConnected ? elapsedRef.current : 0,
    });

    setDisposition(wasConnected ? "Connected - Resolved" : "No answer");
    setNotes("");
  }

  function logCallActivity() {
    const meta = callMetaRef.current;
    const record = {
      id: meta.id,
      number: meta.value,
      source: `${meta.name} (${meta.entityLogicalName})`,
      startedAt: meta.startedAt,
      durationSeconds: elapsedRef.current,
      disposition,
      notes,
    };

    setLoggedCalls((prev) => [record, ...prev]);
    logEvent("call", "Call activity logged locally (no backend/Dataverse write)", record);

    // TODO: real integration — replace the in-memory push above with:
    //   1) a real Bolka backend call, e.g.
    //      POST /calls/{id}/wrapup { disposition, notes, durationSeconds }
    //   2) and/or Microsoft.CIFframework.createRecord('phonecall', {
    //        subject: ..., description: notes, ... }) to write a real
    //      phone call activity back into Dataverse.
    // Neither happens in this demo.

    resetToIdle();
  }

  function resetToIdle() {
    callStateRef.current = CALL_STATE.IDLE;
    callMetaRef.current = null;
    elapsedRef.current = 0;

    setCallState(CALL_STATE.IDLE);
    setCallMeta(null);
    setElapsedSeconds(0);
  }

  function handleSimulateClick() {
    // Fabricated eventData in the exact shape Dynamics sends to onclicktoact.
    const fakeEventData = {
      value: "9833165547",
      name: "mobilephone",
      format: "phone",
      entityLogicalName: "contact",
    };
    logEvent("system", "Simulate button clicked — fabricating onclicktoact-shaped eventData", fakeEventData);
    startSimulatedCall(fakeEventData);
  }

  function handleDial() {
    const number = dialValue.trim();
    if (!number) return;
    startSimulatedCall({
      value: number,
      name: "manual_dial",
      format: "phone",
      entityLogicalName: "manual",
    });
    setDialValue("");
  }

  const idleMessage =
    status === STATUS.LIVE
      ? "No active call. Waiting for onclicktoact from Dynamics, or dial manually."
      : "No active call. Try the simulate button or manual dial below.";

  const dotClass = {
    [STATUS.DETECTING]: styles.dotDetecting,
    [STATUS.LOADING]: styles.dotLoading,
    [STATUS.LIVE]: styles.dotLive,
    [STATUS.STANDALONE]: styles.dotStandalone,
    [STATUS.ERROR]: styles.dotError,
  }[status];

  const badgeClass = {
    [CALL_STATE.RINGING]: styles.badgeRinging,
    [CALL_STATE.CONNECTED]: styles.badgeConnected,
    [CALL_STATE.ENDED]: styles.badgeEnded,
  }[callState];

  const kindClass = {
    cif: styles.kindCif,
    call: styles.kindCall,
    error: styles.kindError,
    system: styles.kindSystem,
  };

  return (
    <div className="appShell">
      <div className={styles.header}>
        <div>
          <h1>Bolka CIF Demo</h1>
          <div className={styles.sub}>click-to-call test harness</div>
        </div>
        <div className={styles.status}>
          <span className={`${styles.dot} ${dotClass}`}></span>
          <span>{STATUS_LABEL[status]}</span>
        </div>
      </div>

      <div className={styles.panel}>
        <h2>Call</h2>

        {callState === CALL_STATE.IDLE && (
          <div>
            <div className={styles.callState}>{idleMessage}</div>

            {status === STATUS.STANDALONE && (
              <button className="block" onClick={handleSimulateClick}>
                Simulate incoming click-to-call
              </button>
            )}

            <label htmlFor="dialInput">Manual dial (test any number)</label>
            <div className={styles.row}>
              <input
                id="dialInput"
                type="text"
                value={dialValue}
                onChange={(e) => setDialValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleDial()}
                placeholder="e.g. 9833165547"
              />
              <button className={styles.dialButton} onClick={handleDial}>
                Call
              </button>
            </div>
            <div className={styles.hint}>
              Manual dial always works, live or standalone — it builds the
              same eventData shape Dynamics would send from onclicktoact.
            </div>
          </div>
        )}

        {callState !== CALL_STATE.IDLE && (
          <div>
            <div className={styles.callActive}>
              <div>
                <span className={`${styles.badge} ${badgeClass}`}>{callState}</span>
                <div className={styles.callState} style={{ margin: "6px 0 0" }}>
                  <span className={styles.num}>{(callMeta && callMeta.value) || "—"}</span>
                </div>
              </div>
              <div className={styles.timer}>{formatTimer(elapsedSeconds)}</div>
            </div>

            {callState !== CALL_STATE.ENDED && (
              <button className="block danger" onClick={endCall}>
                End call
              </button>
            )}

            {callState === CALL_STATE.ENDED && (
              <div className={styles.wrapup}>
                <label htmlFor="disposition">Disposition</label>
                <select
                  id="disposition"
                  value={disposition}
                  onChange={(e) => setDisposition(e.target.value)}
                >
                  <option value="Connected - Resolved">Connected – resolved</option>
                  <option value="Connected - Follow-up needed">Connected – follow-up needed</option>
                  <option value="No answer">No answer</option>
                  <option value="Voicemail">Voicemail</option>
                </select>

                <label htmlFor="notes">Notes</label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What happened on this call?"
                />

                <button className="block primary" onClick={logCallActivity}>
                  Log call activity
                </button>
                <div className={styles.hint}>
                  This only appends to the local list below. No backend or
                  Dataverse write occurs.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.panel}>
        <h2>Logged calls (in-memory, this session only)</h2>
        {loggedCalls.length === 0 ? (
          <div className={styles.empty}>No calls logged yet.</div>
        ) : (
          loggedCalls.map((record) => (
            <div className={styles.callLogItem} key={record.id}>
              <div className={styles.callLogTop}>
                <span>{record.number || "(unknown)"}</span>
                <span>
                  {record.startedAt.toLocaleTimeString(undefined, { hour12: false })} ·{" "}
                  {formatTimer(record.durationSeconds)}
                </span>
              </div>
              <div className={styles.disposition}>{record.disposition}</div>
              {record.notes && <div className={styles.notes}>{record.notes}</div>}
            </div>
          ))
        )}
      </div>

      <div className={styles.panel}>
        <h2>Event log</h2>
        <div className={styles.eventLog} ref={eventLogRef}>
          {events.map((entry) => (
            <div className={`${styles.eventEntry} ${kindClass[entry.kind]}`} key={entry.id}>
              <div className={styles.eventMeta}>
                [{entry.time}] {entry.title}
              </div>
              {entry.data !== undefined && <div>{JSON.stringify(entry.data, null, 2)}</div>}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.footerNote}>
        Bolka CIF demo — see README.md for what&apos;s real vs. simulated.
      </div>
    </div>
  );
}

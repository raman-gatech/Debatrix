import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { trace, SpanStatusCode, Span } from "@opentelemetry/api";
import { createLogger } from "./logger";

const SERVICE_NAME = "agora-sim";
const logger = createLogger("telemetry");

let sdk: NodeSDK | null = null;

export function initTelemetry() {
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    sdk = new NodeSDK({
      serviceName: SERVICE_NAME,
      instrumentations: [
        getNodeAutoInstrumentations({
          "@opentelemetry/instrumentation-fs": { enabled: false },
        }),
      ],
    });

    sdk.start();
    logger.info("OpenTelemetry initialized");
  } else {
    logger.debug("OpenTelemetry endpoint not configured; tracing disabled");
  }
}

export async function shutdownTelemetry(): Promise<void> {
  if (!sdk) return;
  await sdk.shutdown();
  sdk = null;
  logger.info("OpenTelemetry shutdown complete");
}

export function getTracer() {
  return trace.getTracer(SERVICE_NAME);
}

export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  const tracer = getTracer();
  
  return tracer.startActiveSpan(name, async (span) => {
    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        span.setAttribute(key, value);
      });
    }
    
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

export function recordMetric(name: string, value: number, attributes?: Record<string, string>) {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttribute(`metric.${name}`, value);
    if (attributes) {
      Object.entries(attributes).forEach(([key, val]) => {
        span.setAttribute(`metric.${name}.${key}`, val);
      });
    }
  }
}

export { trace, SpanStatusCode };

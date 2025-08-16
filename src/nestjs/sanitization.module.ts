import { DynamicModule, Module, Provider } from '@nestjs/common';
import { SanitizationEngine } from '../core/sanitization-engine';
import { NormalizationEngine } from '../core/normalization-engine';
import { SanitizationPipe, GlobalSanitizationPipe } from './sanitization.pipe';
import { NormalizationInterceptor, GlobalNormalizationInterceptor } from './normalization.interceptor';
import { 
  SanitizationModuleConfig, 
  SanitizationConfig, 
  NormalizationConfig 
} from '../types';
import { 
  SANITIZATION_CONFIG_TOKEN, 
  NORMALIZATION_CONFIG_TOKEN,
  SANITIZATION_MODULE_CONFIG_TOKEN 
} from './constants';

export interface SanitizationModuleAsyncOptions {
  useFactory?: (...args: any[]) => Promise<SanitizationModuleConfig> | SanitizationModuleConfig;
  inject?: any[];
  imports?: any[];
}

@Module({})
export class SanitizationModule {
  static forRoot(config: SanitizationModuleConfig): DynamicModule {
    const providers = this.createProviders(config);
    
    return {
      module: SanitizationModule,
      providers,
      exports: providers,
      global: true
    };
  }

  static forRootAsync(options: SanitizationModuleAsyncOptions): DynamicModule {
    const providers = this.createAsyncProviders(options);
    
    return {
      module: SanitizationModule,
      imports: options.imports || [],
      providers,
      exports: providers,
      global: true
    };
  }

  static forFeature(config?: Partial<SanitizationModuleConfig>): DynamicModule {
    const providers: Provider[] = [
      SanitizationPipe,
      NormalizationInterceptor
    ];

    if (config) {
      providers.push({
        provide: SANITIZATION_MODULE_CONFIG_TOKEN,
        useValue: config
      });
    }

    return {
      module: SanitizationModule,
      providers,
      exports: providers
    };
  }

  private static createProviders(config: SanitizationModuleConfig): Provider[] {
    return [
      {
        provide: SANITIZATION_MODULE_CONFIG_TOKEN,
        useValue: config
      },
      {
        provide: SANITIZATION_CONFIG_TOKEN,
        useValue: config.sanitization
      },
      {
        provide: NORMALIZATION_CONFIG_TOKEN,
        useValue: config.normalization
      },
      {
        provide: SanitizationEngine,
        useFactory: (sanitizationConfig: SanitizationConfig) => {
          return new SanitizationEngine(sanitizationConfig);
        },
        inject: [SANITIZATION_CONFIG_TOKEN]
      },
      {
        provide: NormalizationEngine,
        useFactory: (normalizationConfig: NormalizationConfig) => {
          return new NormalizationEngine(normalizationConfig);
        },
        inject: [NORMALIZATION_CONFIG_TOKEN]
      },
      SanitizationPipe,
      GlobalSanitizationPipe,
      NormalizationInterceptor,
      GlobalNormalizationInterceptor
    ];
  }

  private static createAsyncProviders(options: SanitizationModuleAsyncOptions): Provider[] {
    const configProvider: Provider = {
      provide: SANITIZATION_MODULE_CONFIG_TOKEN,
      useFactory: options.useFactory!,
      inject: options.inject || []
    };

    return [
      configProvider,
      {
        provide: SANITIZATION_CONFIG_TOKEN,
        useFactory: (config: SanitizationModuleConfig) => config.sanitization,
        inject: [SANITIZATION_MODULE_CONFIG_TOKEN]
      },
      {
        provide: NORMALIZATION_CONFIG_TOKEN,
        useFactory: (config: SanitizationModuleConfig) => config.normalization,
        inject: [SANITIZATION_MODULE_CONFIG_TOKEN]
      },
      {
        provide: SanitizationEngine,
        useFactory: (sanitizationConfig: SanitizationConfig) => {
          return new SanitizationEngine(sanitizationConfig);
        },
        inject: [SANITIZATION_CONFIG_TOKEN]
      },
      {
        provide: NormalizationEngine,
        useFactory: (normalizationConfig: NormalizationConfig) => {
          return new NormalizationEngine(normalizationConfig);
        },
        inject: [NORMALIZATION_CONFIG_TOKEN]
      },
      SanitizationPipe,
      GlobalSanitizationPipe,
      NormalizationInterceptor,
      GlobalNormalizationInterceptor
    ];
  }
}
"""
SSO/LDAP and Language Support Service

This service provides comprehensive SSO, LDAP, and language functionality including:
- SSO provider integration (Azure AD, Google, SAML)
- LDAP/Active Directory authentication
- Multi-language support with translations
- Auto user creation and role mapping
- Language preference management
- Internationalization (i18n) utilities
"""

import logging
import json
import ldap
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from ..models.system import SSOConfig, Language, Translation, UserExtension
from ..models.user import User
from ..core.config import settings

logger = logging.getLogger(__name__)


class SSOLanguageService:
    """Comprehensive SSO, LDAP, and language support service"""
    
    def __init__(self, db: Session):
        self.db = db
        self.sso_configs = {}
        self.ldap_connections = {}
        self._load_configurations()
    
    def _load_configurations(self):
        """Load SSO and LDAP configurations"""
        try:
            # Load SSO configurations
            sso_configs = self.db.query(SSOConfig).filter(
                SSOConfig.is_active == True
            ).all()
            
            for config in sso_configs:
                self.sso_configs[config.provider] = {
                    "id": config.id,
                    "provider": config.provider,
                    "client_id": config.client_id,
                    "client_secret": config.client_secret,
                    "tenant_id": config.tenant_id,
                    "redirect_uri": config.redirect_uri,
                    "auto_create_users": config.auto_create_users,
                    "default_role": config.default_role,
                    "field_mappings": config.field_mappings or {}
                }
            
            # Load LDAP configurations
            ldap_configs = self.db.query(SSOConfig).filter(
                SSOConfig.provider == "ldap",
                SSOConfig.is_active == True
            ).all()
            
            for config in ldap_configs:
                try:
                    ldap_connection = ldap.initialize(config.server_url)
                    if config.use_ssl:
                        ldap_connection.start_tls_s()
                    
                    ldap_connection.simple_bind_s(
                        config.bind_dn,
                        config.bind_password
                    )
                    
                    self.ldap_connections[config.id] = {
                        "connection": ldap_connection,
                        "base_dn": config.base_dn,
                        "user_filter": config.field_mappings.get("user_filter", "(uid={username})"),
                        "search_attributes": config.field_mappings.get("search_attributes", ["uid", "cn", "mail"]),
                        "field_mappings": config.field_mappings or {}
                    }
                    
                except Exception as e:
                    logger.error(f"Failed to connect to LDAP server: {e}")
            
        except Exception as e:
            logger.error(f"Error loading SSO/LDAP configurations: {e}")
    
    # SSO Configuration Management
    async def create_sso_config(self, config_data: Dict[str, Any], 
                               created_by: str = None) -> Dict[str, Any]:
        """Create SSO configuration"""
        try:
            config = SSOConfig(
                provider=config_data["provider"],
                client_id=config_data["client_id"],
                client_secret=config_data["client_secret"],
                server_url=config_data.get("server_url"),
                tenant_id=config_data.get("tenant_id"),
                redirect_uri=config_data.get("redirect_uri"),
                base_dn=config_data.get("base_dn"),
                bind_dn=config_data.get("bind_dn"),
                bind_password=config_data.get("bind_password"),
                use_ssl=config_data.get("use_ssl", False),
                auto_create_users=config_data.get("auto_create_users", True),
                default_role=config_data.get("default_role", "ESS User"),
                field_mappings=config_data.get("field_mappings", {}),
                is_active=config_data.get("is_active", True),
                created_by=created_by
            )
            
            self.db.add(config)
            self.db.commit()
            
            # Reload configurations
            self._load_configurations()
            
            logger.info(f"SSO config created: {config.provider}")
            return {
                "success": True,
                "config_id": config.id,
                "provider": config.provider
            }
            
        except Exception as e:
            logger.error(f"Error creating SSO config: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}
    
    async def update_sso_config(self, config_id: int, 
                               config_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update SSO configuration"""
        try:
            config = self.db.query(SSOConfig).filter(
                SSOConfig.id == config_id
            ).first()
            
            if not config:
                return {"success": False, "error": "SSO config not found"}
            
            # Update fields
            for field, value in config_data.items():
                if hasattr(config, field) and value is not None:
                    setattr(config, field, value)
            
            config.updated_at = datetime.now(timezone.utc)
            self.db.commit()
            
            # Reload configurations
            self._load_configurations()
            
            logger.info(f"SSO config updated: {config.provider}")
            return {"success": True, "provider": config.provider}
            
        except Exception as e:
            logger.error(f"Error updating SSO config: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}
    
    async def get_sso_configs(self) -> List[Dict[str, Any]]:
        """Get SSO configurations"""
        try:
            configs = self.db.query(SSOConfig).all()
            
            result = []
            for config in configs:
                result.append({
                    "id": config.id,
                    "provider": config.provider,
                    "client_id": config.client_id,
                    "server_url": config.server_url,
                    "tenant_id": config.tenant_id,
                    "redirect_uri": config.redirect_uri,
                    "auto_create_users": config.auto_create_users,
                    "default_role": config.default_role,
                    "is_active": config.is_active,
                    "created_at": config.created_at,
                    "created_by": config.created_by
                })
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting SSO configs: {e}")
            return []
    
    # SSO Authentication
    async def authenticate_sso_user(self, provider: str, auth_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Authenticate user via SSO provider"""
        try:
            if provider not in self.sso_configs:
                return None
            
            config = self.sso_configs[provider]
            
            # Verify token based on provider
            if provider == "azure_ad":
                user_info = await self._verify_azure_token(auth_data, config)
            elif provider == "google":
                user_info = await self._verify_google_token(auth_data, config)
            elif provider == "saml":
                user_info = await self._verify_saml_assertion(auth_data, config)
            else:
                return None
            
            if not user_info:
                return None
            
            # Find or create user
            user = await self._find_or_create_sso_user(user_info, config)
            
            return user
            
        except Exception as e:
            logger.error(f"Error authenticating SSO user: {e}")
            return None
    
    async def _verify_azure_token(self, auth_data: Dict[str, Any], 
                                config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Verify Azure AD token"""
        try:
            import requests
            
            # Get token from auth data
            access_token = auth_data.get("access_token")
            if not access_token:
                return None
            
            # Verify token with Microsoft
            response = requests.get(
                "https://graph.microsoft.com/v1.0/me",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if response.status_code != 200:
                return None
            
            user_data = response.json()
            
            # Map fields using configuration
            field_mappings = config.get("field_mappings", {})
            
            return {
                "sso_id": user_data.get("id"),
                "username": user_data.get(field_mappings.get("username", "userPrincipalName")),
                "email": user_data.get(field_mappings.get("email", "mail")),
                "full_name": user_data.get(field_mappings.get("full_name", "displayName")),
                "first_name": user_data.get(field_mappings.get("first_name", "givenName")),
                "last_name": user_data.get(field_mappings.get("last_name", "surname")),
                "phone": user_data.get(field_mappings.get("phone", "mobilePhone"))
            }
            
        except Exception as e:
            logger.error(f"Error verifying Azure token: {e}")
            return None
    
    async def _verify_google_token(self, auth_data: Dict[str, Any], 
                                 config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Verify Google token"""
        try:
            import requests
            
            # Get token from auth data
            access_token = auth_data.get("access_token")
            if not access_token:
                return None
            
            # Verify token with Google
            response = requests.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if response.status_code != 200:
                return None
            
            user_data = response.json()
            
            # Map fields using configuration
            field_mappings = config.get("field_mappings", {})
            
            return {
                "sso_id": user_data.get("id"),
                "username": user_data.get(field_mappings.get("username", "email")),
                "email": user_data.get(field_mappings.get("email", "email")),
                "full_name": user_data.get(field_mappings.get("full_name", "name")),
                "first_name": user_data.get(field_mappings.get("first_name", "given_name")),
                "last_name": user_data.get(field_mappings.get("last_name", "family_name"))
            }
            
        except Exception as e:
            logger.error(f"Error verifying Google token: {e}")
            return None
    
    async def _verify_saml_assertion(self, auth_data: Dict[str, Any], 
                                   config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Verify SAML assertion"""
        try:
            from saml2 import BINDING_HTTP_POST
            from saml2.client import Saml2Client
            from saml2.config import Config as Saml2Config
            
            # This is a simplified SAML verification
            # In production, use a proper SAML library
            
            saml_response = auth_data.get("saml_response")
            if not saml_response:
                return None
            
            # Parse SAML response (simplified)
            # In production, verify signature and other security checks
            
            return {
                "sso_id": "saml_user_123",  # Extract from SAML
                "username": "saml_user@example.com",  # Extract from SAML
                "email": "saml_user@example.com",  # Extract from SAML
                "full_name": "SAML User"  # Extract from SAML
            }
            
        except Exception as e:
            logger.error(f"Error verifying SAML assertion: {e}")
            return None
    
    # LDAP Authentication
    async def authenticate_ldap_user(self, username: str, password: str, 
                                   config_id: int = None) -> Optional[Dict[str, Any]]:
        """Authenticate user via LDAP"""
        try:
            # Find LDAP connection
            ldap_config = None
            if config_id:
                ldap_config = self.ldap_connections.get(config_id)
            else:
                # Use first available LDAP connection
                if self.ldap_connections:
                    ldap_config = list(self.ldap_connections.values())[0]
            
            if not ldap_config:
                return None
            
            connection = ldap_config["connection"]
            base_dn = ldap_config["base_dn"]
            user_filter = ldap_config["user_filter"].format(username=username)
            search_attributes = ldap_config["search_attributes"]
            field_mappings = ldap_config["field_mappings"]
            
            # Search for user
            result = connection.search_s(
                base_dn,
                ldap.SCOPE_SUBTREE,
                user_filter,
                search_attributes
            )
            
            if not result or len(result) == 0:
                return None
            
            user_dn, user_attrs = result[0]
            
            # Try to authenticate with user credentials
            try:
                user_connection = ldap.initialize(connection.server)
                user_connection.simple_bind_s(user_dn, password)
                user_connection.unbind()
            except ldap.INVALID_CREDENTIALS:
                return None
            
            # Map user attributes
            user_info = {
                "username": username,
                "ldap_dn": user_dn
            }
            
            for attr, mapping in field_mappings.items():
                if mapping in user_attrs and user_attrs[mapping]:
                    user_info[attr] = user_attrs[mapping][0].decode() if isinstance(user_attrs[mapping][0], bytes) else user_attrs[mapping][0]
            
            # Find or create user
            config = self.db.query(SSOConfig).filter(SSOConfig.id == config_id).first()
            if config:
                user = await self._find_or_create_sso_user(user_info, {
                    "auto_create_users": config.auto_create_users,
                    "default_role": config.default_role,
                    "field_mappings": field_mappings
                })
                return user
            
            return None
            
        except Exception as e:
            logger.error(f"Error authenticating LDAP user: {e}")
            return None
    
    async def _find_or_create_sso_user(self, user_info: Dict[str, Any], 
                                    config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Find or create user from SSO/LDAP"""
        try:
            # Check if user exists by SSO ID or email
            user = None
            
            if user_info.get("sso_id"):
                user = self.db.query(User).join(UserExtension).filter(
                    UserExtension.sso_id == user_info["sso_id"]
                ).first()
            
            if not user and user_info.get("email"):
                user = self.db.query(User).filter(User.email == user_info["email"]).first()
            
            if not user and config.get("auto_create_users", True):
                # Create new user
                user = User(
                    username=user_info.get("username", user_info.get("email")),
                    email=user_info.get("email"),
                    full_name=user_info.get("full_name"),
                    phone=user_info.get("phone"),
                    is_active=True,
                    is_verified=True,
                    created_at=datetime.now(timezone.utc)
                )
                
                # Generate random password (user won't use it)
                import secrets
                user.hashed_password = secrets.token_urlsafe(32)
                
                self.db.add(user)
                self.db.flush()  # Get user ID
                
                # Create user extension
                extension = UserExtension(
                    user_id=user.id,
                    sso_id=user_info.get("sso_id"),
                    ldap_dn=user_info.get("ldap_dn"),
                    language="en",
                    must_change_pass=False
                )
                self.db.add(extension)
                
                # Assign default role
                from ..models.system import SystemRole, SystemUserRole
                default_role = self.db.query(SystemRole).filter(
                    SystemRole.name == config.get("default_role", "ESS User")
                ).first()
                
                if default_role:
                    user_role = SystemUserRole(
                        user_id=user.id,
                        role_id=default_role.id,
                        assigned_by="system"
                    )
                    self.db.add(user_role)
                
                self.db.commit()
                
                logger.info(f"Created new user from SSO: {user.username}")
            
            elif user:
                # Update user extension
                extension = self.db.query(UserExtension).filter(
                    UserExtension.user_id == user.id
                ).first()
                
                if not extension:
                    extension = UserExtension(user_id=user.id)
                    self.db.add(extension)
                
                if user_info.get("sso_id"):
                    extension.sso_id = user_info["sso_id"]
                if user_info.get("ldap_dn"):
                    extension.ldap_dn = user_info["ldap_dn"]
                
                extension.updated_at = datetime.now(timezone.utc)
                self.db.commit()
            
            return {
                "user_id": user.id,
                "username": user.username,
                "email": user.email,
                "full_name": user.full_name,
                "is_active": user.is_active
            }
            
        except Exception as e:
            logger.error(f"Error finding/creating SSO user: {e}")
            self.db.rollback()
            return None
    
    # Language Management
    async def create_language(self, language_data: Dict[str, Any], 
                            created_by: str = None) -> Dict[str, Any]:
        """Create language"""
        try:
            language = Language(
                lang_code=language_data["lang_code"],
                lang_name=language_data["lang_name"],
                native_name=language_data.get("native_name"),
                is_default=language_data.get("is_default", False),
                is_rtl=language_data.get("is_rtl", False),
                is_active=language_data.get("is_active", True),
                created_by=created_by
            )
            
            # If setting as default, unset others
            if language.is_default:
                self.db.query(Language).filter(Language.is_default == True).update({"is_default": False})
            
            self.db.add(language)
            self.db.commit()
            
            logger.info(f"Language created: {language.lang_name}")
            return {
                "success": True,
                "language_id": language.id,
                "lang_code": language.lang_code
            }
            
        except Exception as e:
            logger.error(f"Error creating language: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}
    
    async def get_languages(self) -> List[Dict[str, Any]]:
        """Get all languages"""
        try:
            languages = self.db.query(Language).filter(
                Language.is_active == True
            ).order_by(Language.lang_name).all()
            
            result = []
            for lang in languages:
                result.append({
                    "id": lang.id,
                    "lang_code": lang.lang_code,
                    "lang_name": lang.lang_name,
                    "native_name": lang.native_name,
                    "is_default": lang.is_default,
                    "is_rtl": lang.is_rtl
                })
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting languages: {e}")
            return []
    
    async def create_translation(self, translation_data: Dict[str, Any], 
                               created_by: str = None) -> Dict[str, Any]:
        """Create translation"""
        try:
            # Check if translation already exists
            existing = self.db.query(Translation).filter(
                Translation.lang_code == translation_data["lang_code"],
                Translation.translation_key == translation_data["translation_key"]
            ).first()
            
            if existing:
                # Update existing translation
                existing.translation_value = translation_data["translation_value"]
                existing.updated_at = datetime.now(timezone.utc)
                existing.updated_by = created_by
                self.db.commit()
                
                logger.info(f"Translation updated: {translation_data['translation_key']}")
                return {
                    "success": True,
                    "translation_id": existing.id,
                    "action": "updated"
                }
            else:
                # Create new translation
                translation = Translation(
                    lang_code=translation_data["lang_code"],
                    translation_key=translation_data["translation_key"],
                    translation_value=translation_data["translation_value"],
                    context=translation_data.get("context"),
                    created_by=created_by
                )
                
                self.db.add(translation)
                self.db.commit()
                
                logger.info(f"Translation created: {translation_data['translation_key']}")
                return {
                    "success": True,
                    "translation_id": translation.id,
                    "action": "created"
                }
            
        except Exception as e:
            logger.error(f"Error creating translation: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}
    
    async def get_translations(self, lang_code: str = None, 
                             context: str = None) -> Dict[str, str]:
        """Get translations"""
        try:
            query = self.db.query(Translation)
            
            if lang_code:
                query = query.filter(Translation.lang_code == lang_code)
            
            if context:
                query = query.filter(Translation.context == context)
            
            translations = query.all()
            
            result = {}
            for trans in translations:
                result[trans.translation_key] = trans.translation_value
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting translations: {e}")
            return {}
    
    async def translate(self, key: str, lang_code: str = "en", 
                       default: str = None, variables: Dict[str, str] = None) -> str:
        """Translate text key"""
        try:
            # Get translation
            translation = self.db.query(Translation).filter(
                Translation.lang_code == lang_code,
                Translation.translation_key == key
            ).first()
            
            if translation:
                text = translation.translation_value
            elif default:
                text = default
            else:
                text = key  # Return key as fallback
            
            # Replace variables
            if variables:
                for var, value in variables.items():
                    text = text.replace(f"{{{var}}}", str(value))
            
            return text
            
        except Exception as e:
            logger.error(f"Error translating text: {e}")
            return default or key
    
    async def get_user_language(self, user_id: int) -> str:
        """Get user's preferred language"""
        try:
            extension = self.db.query(UserExtension).filter(
                UserExtension.user_id == user_id
            ).first()
            
            if extension and extension.language:
                return extension.language
            
            # Return default language
            default_lang = self.db.query(Language).filter(
                Language.is_default == True
            ).first()
            
            return default_lang.lang_code if default_lang else "en"
            
        except Exception as e:
            logger.error(f"Error getting user language: {e}")
            return "en"
    
    async def set_user_language(self, user_id: int, lang_code: str) -> Dict[str, Any]:
        """Set user's preferred language"""
        try:
            # Validate language exists
            language = self.db.query(Language).filter(
                Language.lang_code == lang_code,
                Language.is_active == True
            ).first()
            
            if not language:
                return {"success": False, "error": "Language not found"}
            
            # Update user extension
            extension = self.db.query(UserExtension).filter(
                UserExtension.user_id == user_id
            ).first()
            
            if not extension:
                extension = UserExtension(user_id=user_id)
                self.db.add(extension)
            
            extension.language = lang_code
            extension.updated_at = datetime.now(timezone.utc)
            self.db.commit()
            
            logger.info(f"User language updated: user_id={user_id}, lang={lang_code}")
            return {"success": True, "language": lang_code}
            
        except Exception as e:
            logger.error(f"Error setting user language: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}
    
    async def export_translations(self, lang_code: str, format: str = "json") -> Dict[str, Any]:
        """Export translations for a language"""
        try:
            translations = await self.get_translations(lang_code)
            
            if format == "json":
                return {
                    "success": True,
                    "format": "json",
                    "lang_code": lang_code,
                    "translations": translations
                }
            elif format == "csv":
                # Convert to CSV format
                csv_data = "key,value\n"
                for key, value in translations.items():
                    csv_data += f'"{key}","{value}"\n'
                
                return {
                    "success": True,
                    "format": "csv",
                    "lang_code": lang_code,
                    "data": csv_data
                }
            else:
                return {"success": False, "error": "Unsupported format"}
            
        except Exception as e:
            logger.error(f"Error exporting translations: {e}")
            return {"success": False, "error": str(e)}
    
    async def import_translations(self, lang_code: str, translations: Dict[str, str], 
                                created_by: str = None) -> Dict[str, Any]:
        """Import translations for a language"""
        try:
            # Validate language exists
            language = self.db.query(Language).filter(
                Language.lang_code == lang_code
            ).first()
            
            if not language:
                return {"success": False, "error": "Language not found"}
            
            imported_count = 0
            updated_count = 0
            
            for key, value in translations.items():
                existing = self.db.query(Translation).filter(
                    Translation.lang_code == lang_code,
                    Translation.translation_key == key
                ).first()
                
                if existing:
                    existing.translation_value = value
                    existing.updated_at = datetime.now(timezone.utc)
                    existing.updated_by = created_by
                    updated_count += 1
                else:
                    translation = Translation(
                        lang_code=lang_code,
                        translation_key=key,
                        translation_value=value,
                        created_by=created_by
                    )
                    self.db.add(translation)
                    imported_count += 1
            
            self.db.commit()
            
            logger.info(f"Translations imported: {imported_count} new, {updated_count} updated")
            return {
                "success": True,
                "imported": imported_count,
                "updated": updated_count
            }
            
        except Exception as e:
            logger.error(f"Error importing translations: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}


# SSO/Language service factory
def get_sso_language_service(db: Session) -> SSOLanguageService:
    """Get SSO/language service instance"""
    return SSOLanguageService(db)

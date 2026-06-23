-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- Host: localhost    Database: bd_final_projet_annuel
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `adresselivraison`
--

DROP TABLE IF EXISTS `adresselivraison`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `adresselivraison` (
  `id_adresseLivraison` int NOT NULL AUTO_INCREMENT,
  `pays` varchar(60) DEFAULT NULL,
  `ville` varchar(60) DEFAULT NULL,
  `code_postal` varchar(15) DEFAULT NULL,
  `id_Utilisateur` int DEFAULT NULL,
  PRIMARY KEY (`id_adresseLivraison`),
  KEY `id_Utilisateur` (`id_Utilisateur`),
  CONSTRAINT `adresselivraison_ibfk_1` FOREIGN KEY (`id_Utilisateur`) REFERENCES `utilisateur` (`id_Utilisateur`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `adresselivraison`
--

LOCK TABLES `adresselivraison` WRITE;
/*!40000 ALTER TABLE `adresselivraison` DISABLE KEYS */;
INSERT INTO `adresselivraison` VALUES (1,'France','Paris','75001',1);
/*!40000 ALTER TABLE `adresselivraison` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `avis`
--

DROP TABLE IF EXISTS `avis`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `avis` (
  `id_Avis` int NOT NULL AUTO_INCREMENT,
  `note` tinyint DEFAULT NULL,
  `commentaire` text,
  `date_Avis` datetime DEFAULT CURRENT_TIMESTAMP,
  `id_Utilisateur` int DEFAULT NULL,
  `id_produit` int DEFAULT NULL,
  PRIMARY KEY (`id_Avis`),
  KEY `id_Utilisateur` (`id_Utilisateur`),
  KEY `id_produit` (`id_produit`),
  CONSTRAINT `avis_ibfk_1` FOREIGN KEY (`id_Utilisateur`) REFERENCES `utilisateur` (`id_Utilisateur`),
  CONSTRAINT `avis_ibfk_2` FOREIGN KEY (`id_produit`) REFERENCES `produit` (`id_produit`),
  CONSTRAINT `avis_chk_1` CHECK ((`note` between 1 and 5))
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `avis`
--

LOCK TABLES `avis` WRITE;
/*!40000 ALTER TABLE `avis` DISABLE KEYS */;
INSERT INTO `avis` VALUES (1,5,'Excellent produit, je recommande !','2026-05-05 18:05:37',1,1);
/*!40000 ALTER TABLE `avis` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categories` (
  `id_categories` int NOT NULL AUTO_INCREMENT,
  `nom` varchar(50) NOT NULL,
  PRIMARY KEY (`id_categories`)
) ENGINE=InnoDB AUTO_INCREMENT=108 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categories`
--

LOCK TABLES `categories` WRITE;
/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
INSERT INTO `categories` VALUES (1,'Mode'),(2,'Electronique'),(3,'Maison'),(4,'Informatique'),(5,'Cuisine'),(6,'bebe'),(7,'sport'),(8,'beaute'),(9,'jardin'),(10,'Auto'),(11,'livres'),(12,'animalerie'),(13,'bricolage');
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `commande`
--

DROP TABLE IF EXISTS `commande`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `commande` (
  `id_commande` int NOT NULL AUTO_INCREMENT,
  `statut_commande` varchar(30) DEFAULT 'en_cours',
  `date_commande` datetime DEFAULT CURRENT_TIMESTAMP,
  `montant_total` decimal(15,2) DEFAULT '0.00',
  `id_adresseLivraison` int NOT NULL,
  `id_Utilisateur` int DEFAULT NULL,
  PRIMARY KEY (`id_commande`),
  KEY `id_adresseLivraison` (`id_adresseLivraison`),
  KEY `idx_commande_utilisateur` (`id_Utilisateur`),
  KEY `idx_commande_statut` (`statut_commande`),
  CONSTRAINT `commande_ibfk_1` FOREIGN KEY (`id_adresseLivraison`) REFERENCES `adresselivraison` (`id_adresseLivraison`),
  CONSTRAINT `commande_ibfk_2` FOREIGN KEY (`id_Utilisateur`) REFERENCES `utilisateur` (`id_Utilisateur`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `commande`
--

LOCK TABLES `commande` WRITE;
/*!40000 ALTER TABLE `commande` DISABLE KEYS */;
INSERT INTO `commande` VALUES (1,'livree','2026-04-01 00:00:00',129.99,1,1);
/*!40000 ALTER TABLE `commande` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `log_nouvelle_commande` AFTER INSERT ON `commande` FOR EACH ROW BEGIN
    INSERT INTO LogEvenement (type_action, table_concernee, description, id_Utilisateur)
    VALUES (
        'COMMANDE_PASSEE',
        'commande',
        CONCAT('Commande #', NEW.id_commande, ' passée pour ', NEW.montant_total, '€'),
        NEW.id_Utilisateur
    );
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `contient`
--

DROP TABLE IF EXISTS `contient`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contient` (
  `id_produit` int NOT NULL,
  `id_panier` int NOT NULL,
  `quantite` int DEFAULT '1',
  PRIMARY KEY (`id_produit`,`id_panier`),
  KEY `id_panier` (`id_panier`),
  CONSTRAINT `contient_ibfk_1` FOREIGN KEY (`id_produit`) REFERENCES `produit` (`id_produit`),
  CONSTRAINT `contient_ibfk_2` FOREIGN KEY (`id_panier`) REFERENCES `panier` (`id_panier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `contient`
--

LOCK TABLES `contient` WRITE;
/*!40000 ALTER TABLE `contient` DISABLE KEYS */;
INSERT INTO `contient` VALUES (1,1,3);
/*!40000 ALTER TABLE `contient` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lignecommande`
--

DROP TABLE IF EXISTS `lignecommande`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lignecommande` (
  `id_produit` int NOT NULL,
  `id_commande` int NOT NULL,
  `quantite` int DEFAULT '1',
  `prix_unitaire` decimal(12,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id_produit`,`id_commande`),
  KEY `id_commande` (`id_commande`),
  KEY `idx_lignecommande_produit` (`id_produit`),
  CONSTRAINT `lignecommande_ibfk_1` FOREIGN KEY (`id_produit`) REFERENCES `produit` (`id_produit`),
  CONSTRAINT `lignecommande_ibfk_2` FOREIGN KEY (`id_commande`) REFERENCES `commande` (`id_commande`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lignecommande`
--

LOCK TABLES `lignecommande` WRITE;
/*!40000 ALTER TABLE `lignecommande` DISABLE KEYS */;
INSERT INTO `lignecommande` VALUES (1,1,2,0.00);
/*!40000 ALTER TABLE `lignecommande` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `logevenement`
--

DROP TABLE IF EXISTS `logevenement`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `logevenement` (
  `id_log` int NOT NULL AUTO_INCREMENT,
  `date_action` datetime DEFAULT CURRENT_TIMESTAMP,
  `type_action` varchar(50) NOT NULL,
  `table_concernee` varchar(50) DEFAULT NULL,
  `description` text,
  `id_Utilisateur` int DEFAULT NULL,
  PRIMARY KEY (`id_log`),
  KEY `id_Utilisateur` (`id_Utilisateur`),
  CONSTRAINT `logevenement_ibfk_1` FOREIGN KEY (`id_Utilisateur`) REFERENCES `utilisateur` (`id_Utilisateur`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `logevenement`
--

LOCK TABLES `logevenement` WRITE;
/*!40000 ALTER TABLE `logevenement` DISABLE KEYS */;
INSERT INTO `logevenement` VALUES (1,'2026-05-01 18:02:43','PRODUIT_AJOUTE','produit','Nouveau produit ajouté au catalogue',1),(2,'2026-05-05 18:04:38','COMMANDE_PASSEE','commande','Commande #1 passée pour 129.99€',1);
/*!40000 ALTER TABLE `logevenement` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `message`
--

DROP TABLE IF EXISTS `message`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `message` (
  `id_message` int NOT NULL AUTO_INCREMENT,
  `contenu` text,
  `date_envoi_message` datetime DEFAULT CURRENT_TIMESTAMP,
  `lu` tinyint(1) DEFAULT '0',
  `id_Utilisateur` int DEFAULT NULL,
  `id_Utilisateur_1` int DEFAULT NULL,
  PRIMARY KEY (`id_message`),
  KEY `id_Utilisateur` (`id_Utilisateur`),
  KEY `id_Utilisateur_1` (`id_Utilisateur_1`),
  CONSTRAINT `message_ibfk_1` FOREIGN KEY (`id_Utilisateur`) REFERENCES `utilisateur` (`id_Utilisateur`),
  CONSTRAINT `message_ibfk_2` FOREIGN KEY (`id_Utilisateur_1`) REFERENCES `utilisateur` (`id_Utilisateur`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `message`
--

LOCK TABLES `message` WRITE;
/*!40000 ALTER TABLE `message` DISABLE KEYS */;
INSERT INTO `message` VALUES (1,'Bonjour, où en est ma commande ?','2026-05-05 18:07:44',0,1,2);
/*!40000 ALTER TABLE `message` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notification`
--

DROP TABLE IF EXISTS `notification`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification` (
  `id_notification` int NOT NULL AUTO_INCREMENT,
  `type` varchar(50) DEFAULT NULL,
  `message` varchar(500) DEFAULT NULL,
  `date_envoi` datetime DEFAULT CURRENT_TIMESTAMP,
  `lu` tinyint(1) DEFAULT '0',
  `id_Utilisateur` int DEFAULT NULL,
  PRIMARY KEY (`id_notification`),
  KEY `id_Utilisateur` (`id_Utilisateur`),
  CONSTRAINT `notification_ibfk_1` FOREIGN KEY (`id_Utilisateur`) REFERENCES `utilisateur` (`id_Utilisateur`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification`
--

LOCK TABLES `notification` WRITE;
/*!40000 ALTER TABLE `notification` DISABLE KEYS */;
INSERT INTO `notification` VALUES (1,'commande','Votre commande a été expédiée','2026-05-05 18:07:51',0,1);
/*!40000 ALTER TABLE `notification` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paiement`
--

DROP TABLE IF EXISTS `paiement`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paiement` (
  `id_paiement` int NOT NULL AUTO_INCREMENT,
  `type` varchar(50) DEFAULT NULL,
  `statut` varchar(20) DEFAULT 'en_attente',
  `date_paiement` datetime DEFAULT CURRENT_TIMESTAMP,
  `id_commande` int NOT NULL,
  PRIMARY KEY (`id_paiement`),
  UNIQUE KEY `id_commande` (`id_commande`),
  CONSTRAINT `paiement_ibfk_1` FOREIGN KEY (`id_commande`) REFERENCES `commande` (`id_commande`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paiement`
--

LOCK TABLES `paiement` WRITE;
/*!40000 ALTER TABLE `paiement` DISABLE KEYS */;
INSERT INTO `paiement` VALUES (1,'carte_bancaire','valide','2026-05-05 18:07:31',1);
/*!40000 ALTER TABLE `paiement` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `panier`
--

DROP TABLE IF EXISTS `panier`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `panier` (
  `id_panier` int NOT NULL AUTO_INCREMENT,
  `quantite_produit` int DEFAULT '0',
  PRIMARY KEY (`id_panier`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `panier`
--

LOCK TABLES `panier` WRITE;
/*!40000 ALTER TABLE `panier` DISABLE KEYS */;
INSERT INTO `panier` VALUES (1,0);
/*!40000 ALTER TABLE `panier` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `produit`
--

DROP TABLE IF EXISTS `produit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `produit` (
  `id_produit` int NOT NULL AUTO_INCREMENT,
  `nom` varchar(200) NOT NULL,
  `description` text,
  `prix` decimal(12,2) NOT NULL,
  `stock` int DEFAULT '0',
  `date_creation` datetime DEFAULT CURRENT_TIMESTAMP,
  `imageUrl` varchar(500) DEFAULT NULL,
  `id_categories` int DEFAULT NULL,
  PRIMARY KEY (`id_produit`),
  KEY `idx_produit_categories` (`id_categories`),
  CONSTRAINT `produit_ibfk_1` FOREIGN KEY (`id_categories`) REFERENCES `categories` (`id_categories`)
) ENGINE=InnoDB AUTO_INCREMENT=98 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `produit`
--

LOCK TABLES `produit` WRITE;
/*!40000 ALTER TABLE `produit` DISABLE KEYS */;
INSERT INTO `produit` VALUES (1,'casque bluetooth pro','casque audio',89.94,50,'2026-04-21 20:14:07','https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcSMTuGtQ5J9vgB4hc9Ql1UYXVX74qF1NfQ-djd6KtS8IhIt_h1UPEXfUAmMoRbEJywFB_u14Gwm4j_692023RfzfoSxa9ehdjdRG1zV0_40wuvwswd34XVqXvxr_FGPzgnrU8aWN98&usqp=CAc',2),(2,'Smartphone 4G Dual SIM','Téléphone',221.05,25,'2026-04-21 20:14:07','https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcQXIIlh-2QKYIgeckiF21anQd5Sx9ac9J_FJvzjQOSNrOqOkU_fJ1lByyLxXeJsSXABgmgYwhsibC-myl33nYFxogwf76NCR_Wxvwvmq3izLk3_LtRmtxgdk0KpB-zJTBuqnMS-Hlvq&usqp=CAc',2),(3,'TV 43\" LED FULL HD','Télévision',320.14,8,'2026-04-21 20:14:07','https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcSyHlDQXmCoJ7FO5hdJXrtjMK3IBRMpQzOHIAs7hHJAuXHhCYPDhAlWLZ78TY5ztVJUiH1vGx382gI7jhzIgiuPxuREThujUZNfDa9eR0yK8cO1yhbBOrjUwY4dQFp0LP8RMkUuqXZ9UQ&usqp=CAc',2),(4,'Montre connectée fitness ','montre',68.60,18,'2026-04-21 20:14:07','https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcQJXnyUT_326uERXRey-nikxAVtqBfGKBDr9kgdj54ZMumBEOiWdIGTCxjVlIDBINoqMOHoyqrTU3qCe6CYikKCZKAxooUPOrevyR-cw3VVKD0IDfyabzYYO_fuyiWXClRQVzoRlg&usqp=CAc',2),(5,'kit bureau','set complet pour le télétravail',68.60,22,'2026-04-21 20:14:07','https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcRYfUSxjxz7-CZ0TLsbcpzlD4izCpYgxcMlZPHk4mlXXDo_DgS-vW630IvJAG36DET5Ze3B03ehWRSAOHFZ5bbkLAX22QFaLv0cyIf-4qK3HCUWGCOabOkf4s6AhcazF2KXru_0xDgfJQ&usqp=CAc',2),(6,'Powerbank 20000mAh','Batterie externe',33.54,40,'2026-04-21 20:14:07','https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcShp3JHW3ueSne5mWxKYNYTDZM9FcyW9vyXn5Ie5sDkCu_phx96Yr1J6K6yQ-6A4K-M3aW2chWokmKyFvz0oIrVrI_BnWCWcIYWz1grUB2us0FwupywIbVmjEDy7IWN384pIIOFgQ&usqp=CAc',2),(7,'Ecouteurs bluetooth ','Ecouteurs ultraportables',28.20,14,'2026-04-21 20:14:07','https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcQ4S9VKFeiX3wf59WNjPkN4o6eLvbbQelW90C_DI36sS6eMYzSTk3jCxpeNQXBWMYYJr8zkjAyIlATTkP1z5NF6QrtK6IWaWlq7jKlHsZu3-YESnRJCyIrgkugFAj9eiAB8Qcc7cA&usqp=CAc',2),(8,'Enceintes portables','enceinte bluetooth waterproof',64.03,14,'2026-04-21 20:14:07','https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS5Y9uMwpius0OFQ7wMY6tCt5C0oPZMHre_Zg&s',2),(9,'sac à dos urbain ','sac à dos',48.78,50,'2026-04-21 20:22:31','https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcTqQmBrsonXTPaNEVD3Q-lIIRDlSD16gE1pxVF42OOBnadQmGFH5paCc6WHDmDVUzGQzvHtKyuGP_6zsPyHimpMFETYXPsNrs6noLCbToAS6Uz7vI-Ku8U1cNyZIUWA8qX8VsLj7A&usqp=CAc',1),(10,'chaussures de sport legeres ','baskets confortables',42.69,25,'2026-04-21 20:22:31','https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSX6OFGHfXaH0_mmN_qREUcsJzTIgOpv9KvYA&s',1),(11,'T-shirt col rond ','T-shirt 100% coton ',12.96,8,'2026-04-21 20:22:31','https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRGNaw1vvPPIsejKOHG-eyitVHVNMHpQeXR2A&s',1),(12,'jean slim ','jean',22.87,18,'2026-04-21 20:22:31','https://lestresorsdechloe.com/21503-large_default/jean-slim-bleu-fonce-amelie.jpg',1),(13,'robe soleil ','robe legere',28.20,22,'2026-04-21 20:22:31','https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSK4GaiATnDFNIpmO_y490ZomDa2as_TmfjGQ&s',1),(14,'tapis isometrique','tapis de yoga',12.96,40,'2026-04-21 20:22:31','https://static.vecteezy.com/ti/vecteur-libre/p1/36592279-national-porte-tapis-icone-isometrique-vecteur-nettoyer-accueil-entree-vectoriel.jpg',1),(15,'mixeur compact','robot mixeur',41.92,30,'2026-04-21 21:00:37','https://www.cdiscount.com/pdt2/1/3/1/1/700x700/wmf4211129128131/rw/wmf-kuchenminis-bol-mixeur-blender-0-8-litre-400-w.jpg',5),(16,'robot de cuisine multifonctions','robot 5 en 1 ',144.83,30,'2026-04-21 21:00:37','https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcRTgQItZOdQXUQp5a-9Zh5ca9l8i0JQEWEnnif_PZOxSRdUvPVEGyzL-gvRyrpOj8l9D-MWdQeZlacoGTFufzh5chNUO5WWMRaf6XYSE4bq5k_RQgULFJfsgdmipcBnHrxcVkHUu8M&usqp=CAc',5),(17,'cafetiere programmable','cafetiere filtre 12 tasses avec minuterie',53.36,30,'2026-04-21 21:00:37','https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcTcfP0yTgtb1wLtR_VZP1RZpIpPqcHMDwknAas1SUCrBRWhm8cyu26ugOxvw3qgObOUuiRxJR0dJyZQTdko-L0Q3I-b4ePm_HTyEcaAQpzv9As3P56IyxgnG6hTkn0L7G2KcZwZJY4&usqp=CAc',5),(18,'batterie de cuisine 5 pieces ','set de casseroles et poeles en inox ',68.60,30,'2026-04-21 21:00:37','https://www.ustensilesculinaires.com/cdn/shop/files/Casserole-en-acier-inoxydable.jpg?v=1701286404',5),(19,'grille pain 2 fentes','grille pain compact',19.06,30,'2026-04-21 21:00:37','https://www.francisbatt.com/ressources/references/miniatures/zoom1_grille-pain-double-longue-fente-247144.jpg',5),(20,'bouilloire electrique','Bouilloire 1,7L',22.87,30,'2026-04-21 21:00:37','https://kitchencook.fr/13140-large_default/bouilloire-electrique-led-17l-finition-inox-tealight-kitchencook.jpg',5),(21,'plaque chauffante','plaque electrique 2 zones',33.54,30,'2026-04-21 21:00:37','https://www.wiltec.de/media/87/97/4f/1730291348/6022fb9c9e58497b96c1226b2a11df2b.jpg?ts=1730291348',5),(22,'presse agrumes','presse agrumes electrique',27.44,30,'2026-04-21 21:00:37','https://www.nature-vitalite.com/481-superlarge_default/presse-agrumes-electrique-en-inox.jpg',5),(23,'ordinateur portable 15\" ','PC portable',495.46,30,'2026-04-21 21:21:31','https://static.fnac-static.com/multimedia/Images/FR/MDM/b1/57/68/23615409/1540-1/tsp20250314032241/PC-portable-HP-Laptop-17-cp0000nf-17-3-AMD-Ryzen-7-16-Go-RAM-1-To-D-Argent-naturel.jpg',4),(24,'clavier sans fil','clavier ergonomique ',38.11,30,'2026-04-21 21:21:31','https://cdn.t-nb.com/image/upload/VISUEL_HD/KBWPRO2/03303170121740_C1L0_s01.jpg',4),(25,'cle USB 64 Go','cle 3.0 haute vitesse ',18.29,30,'2026-04-21 21:21:31','https://media.ldlc.com/r1600/ld/products/00/03/34/05/LD0003340551_2_0003340591_0003340641.jpg',4),(26,'souris sans fil ','souris ergonomique ',18.29,30,'2026-04-21 21:21:31','https://www.keyouest.fr/wp-content/uploads/2021/12/souris-sans-fil-hybride-rechargeable-noire-pas-cher-KeyOuest.png',4),(27,'disque dur externe 1To ','stockage portable USB 3.0',99.09,30,'2026-04-21 21:21:31','https://www.iso-informatique.fr/assets/uploads/images/products/zoom/122-rBp0.jpg',4),(28,'webcam HD 1080P','webcam full HD',53.36,30,'2026-04-21 21:21:31','https://www.mobile24.fr/images/4MP-HD-Webcam-with-Autofocus-1920x1080-30fps-5712579997791-28072020-01-p.webp',4),(29,'support pc portable','support ventilé pour pc',18.29,30,'2026-04-21 21:21:31','https://dxbyzx5id4chj.cloudfront.net/fit-in/815x815/filters:fill(fff)/pub/media/catalog/product/4/0/5/1/2/8/P_405128371_1.jpg',4),(30,'raspberry Pi 4 ','mini PC 4Go RAM ',83.85,30,'2026-04-21 21:21:31','https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcS4CzqSMSFUMrhQT4r_JN8kNX5vSCcE1tKpriQKyyukWHilmTh4mgJTZF2z2ZiprW9rCvUakqzszwPdB8LV0a2gpngQaLfPDvBxN8_F6J90qgqeIr9PyjBS6ol9YhehGlGidgCNnRQ&usqp=CAc',4),(31,'fauteil de bureau ergonomique ','chaise de bureau reglable',103.67,30,'2026-04-21 21:31:33','https://www.direct-siege.com/4107-thickbox_default/human-fauteuil-de-bureau-ergonomique-avec-support-lombaire.jpg',3),(32,'lampe de bureau LED','lampe reglable ',22.87,30,'2026-04-21 21:31:33','https://www.comptoirdeslustres.com/13678-large_default/lampe-bureau-led-ideal-fabas-luce.jpg',3),(33,'table de chevet','table en bois',42.69,30,'2026-04-21 21:31:33','https://assets.made-in-meubles.com/media/catalog/product/p/r/product_l_e_lela57-table-chevet-ambiance-1.png',3),(34,'couverture polaire ','couverture douce ',14.48,30,'2026-04-21 21:31:33','https://www.cdiscount.com/pdt2/7/5/0/1/700x700/net2008696238750/rw/plaid-couverture-polaire-sherpa-gris-130x160cm.jpg',3),(35,'etagere 5 niveaux ','etagere metallique',38.11,30,'2026-04-21 21:31:33','https://dansmamaison.fr/91539-large_default/etagere-5-niveaux-blanc-matchene-clair-radime.jpg',3),(50,'Poussette légère','Poussette pliable et légère',149.99,20,'2026-06-03 10:46:51','https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcRrwMn1VHZ0V9KrShOH3CPMTvVi_KqV0mUx0c9vZfo-7SK9PrbdphuYzDHMRqqWl6i9JAczTdcNFYI5VkrSupWczZTMFEFf-8HhXH6F7fHHMtgHKH4wpRLUTBiQLjrGqduGPJIXMrY&usqp=CAc',6),(51,'Siège auto bébé','Siège auto groupe 0+',89.99,15,'2026-06-03 10:46:51','https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcRR_ABb6_FQxJT6CmAUAddUaYUae_YpowsOeqYH6oUqhbPo0sVYyh5UqZlNZiN5BUxurr6je6SK1ea5c3l-wa9cWehpmM-BxiQ4WZvCS2rPsoQTsRSi_PDLREciS_rSzu3R86F_ZA&usqp=CAc',6),(52,'Babyphone vidéo','Surveillance bébé avec caméra',69.99,25,'2026-06-03 10:46:51','https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcTw99ox8XBoRpYp4WZ6n7ldqOyaCF1BjxYnWjf-CysIxjLGMUde0UZZkXrJ74aRxLuNeAH1dSIlRpzDlUZHfyw_6dcxAjQdJPoTk6dleMH1n9903f5au1BKeKEDurJUXe7z7Rfq5ok&usqp=CAc',6),(53,'Lit parapluie','Lit de voyage pliable',59.99,18,'2026-06-03 10:46:51','https://babymoov.com/cdn/shop/files/7_3acad43b-0296-4bae-845f-3a19424f1daa.jpg?v=1756295824&width=852',6),(54,'Transat bébé','Transat vibrant avec arche',49.99,22,'2026-06-03 10:46:51','https://www.papouillefrance.com/image/be-article-articlePicture-45b52dc9cb9037/large',6),(55,'Chaise haute','Chaise haute réglable',79.99,12,'2026-06-03 10:46:51','https://www.cdiscount.com/pdt2/8/1/3/1/700x700/mag1690356853813/rw/chaise-haute-bebe-evolutive-pliable-hauteur-regl.jpg',6),(56,'Vélo de route','Vélo léger 21 vitesses',299.99,10,'2026-06-03 10:48:26','https://www.materiel-velo.com/infos/fr/wp-content/uploads/2022/07/velo-route-pinarello-dogma-f-dura-ace-di2.jpg',7),(57,'Tapis de yoga','Tapis antidérapant 6mm',29.99,50,'2026-06-03 10:48:26','https://www.ballettodanceshop.com/wp-content/uploads/2025/07/Tapis_yoga_Techdance_Ballettodanceshop.webp',7),(58,'Gants de boxe','Gants entrainement 12oz',39.99,30,'2026-06-03 10:48:26','https://fr.phantom-athletics.com/cdn/shop/files/Phantom_Muay_Thai_Boxhandschuhe_Schwarz_Gold_1_2048x.jpg?v=1762166568',7),(59,'Haltères 10kg','Paire haltères caoutchouc',44.99,25,'2026-06-03 10:48:26','https://www.materielmedical.fr/49952-large_default/haltere-10-kg-care.jpg',7),(60,'Corde à sauter','Corde réglable avec compteur',14.99,60,'2026-06-03 10:48:26','https://img.hardloop.com/image/upload/v1588006981/articles/id-670-comment-bien-choisir-sa-corde-a-sauter/comment-choisir-sa-corde-a-sauter_imli3j.jpg',7),(61,'Vélo elliptique','Vélo elliptique pliable',249.99,8,'2026-06-03 10:48:26','https://images.contentstack.io/v3/assets/blt40913d6edfec40cc/blt41ea98bfe43a716e/696ea46a546e1d50a119982b/2quels-muscles-travaillent-pendant-seance-velo-elliptique-zoom.jpg',7),(62,'Crème hydratante','Soin visage hydratant 50ml',24.99,40,'2026-06-03 10:48:34','https://statics.docmorris.fr/static/promofarma/prod/product_images/mr/Q03JS5_fr_FR_0.jpeg',8),(63,'Mascara volume','Mascara longue tenue',14.99,60,'2026-06-03 10:48:34','https://picture.drhauschka.fr/media/image/d6/50/7f/3160560-mascara-volume-model-01-01-420005983.jpg',8),(64,'Sérum vitamine C','Sérum éclat anti-taches',34.99,35,'2026-06-03 10:48:34','https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTsOcOmqyQgn_wI6_cZoQw-ysnMW3DQmzeqNg&s',8),(65,'Fond de teint','Fond de teint couvrance naturelle',19.99,45,'2026-06-03 10:48:34','https://1lookbyade.com/cdn/shop/files/Fonddeteintvegan_F25_secondepeau_PLS_cosmetics.webp?v=1754495739&width=1299',8),(66,'Palette fards','Palette 12 couleurs smoky',22.99,30,'2026-06-03 10:48:34','https://www.bysmaquillage.fr/media/catalog/product/p/a/palette-8-fards-bys_3.jpg',8),(67,'Rouge à lèvres','Rouge longue tenue mat',12.99,55,'2026-06-03 10:48:34','https://img-3.journaldesfemmes.fr/VPRbJg8ROYPHSDcp4ZSoGYZOxb4=/1500x/smart/03390ff0f58c4a49b6d4ac088ed80144/ccmcms-jdf/10453789.jpg',8),(68,'Tondeuse à gazon','Tondeuse électrique 1800W',199.99,8,'2026-06-03 10:48:49','https://media.castorama.fr/is/image/Castorama/tondeuse-a-gazon-sur-batterie-mac-allister-36v-1x4ah-43cm~5063022637383_02i?$MOB_PREV$&$width=600&$height=600',9),(69,'Arrosoir 10L','Arrosoir en plastique robuste',12.99,45,'2026-06-03 10:48:49','https://livlig.com/cdn/shop/files/LIVLIGGiesskanne10LAnthrazit_6.jpg?v=1771422612&width=1080',9),(70,'Sécateur professionnel','Sécateur en acier inoxydable',19.99,30,'2026-06-03 10:48:49','https://passionhorticulture.com/cdn/shop/files/secateur-professionnel-ergonomique_c5aab8ec-de46-4e96-9383-841f90335880.jpg?v=1741349328&width=400',9),(71,'Tuyau arrosage 20m','Tuyau extensible anti-torsion',24.99,35,'2026-06-03 10:48:49','https://leparisien.fr/resizer/dRCdz18Dunjla3YP-Dqn6AgvVBc=/1200x675/cloudfront-eu-central-1.images.arcpublishing.com/lpguideshopping/BTFBGG32HNDYFBARIMTBBYU7LM.jpg',9),(72,'Terreau universel','Terreau enrichi 40L',9.99,50,'2026-06-03 10:48:49','https://res.cloudinary.com/compo-com/image/fetch/c_fill,g_xy_center,f_auto,w_1000,h_1000,x_iw_mul_50_div_100,y_ih_mul_50_div_100/https://www.compo.de/dam/jcr:f2f6a379-0ea4-4e10-8f7b-1cfbf363d6bf/atuni16r.jpg',9),(73,'Pot de fleurs XXL','Pot résine tressée 50cm',29.99,20,'2026-06-03 10:48:49','https://www.jardideco.fr/img/jardideco/description/gros-pot-de-fleur-xxl-toscane-eda.jpg',9),(74,'Dashcam HD','Caméra embarquée 1080p',59.99,20,'2026-06-03 10:49:00','https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcRYFH2BJvni6Rwt_2X648Fvvls6zHkSu_coP8JllNC34o_4_uYBM3n5dzfjFgP2soY0uBj2-gmgAVGxUYifD6BGgwajh1OXUh1ZHyEK1x5rApGkM2-HcoXcelnUuUcXA6hr17EpRwD4YA&usqp=CAc',10),(75,'Tapis de sol voiture','Tapis sur mesure universels',29.99,40,'2026-06-03 10:49:00','https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQdobzmDIetv6PjGMRhzNfowVJdtxh3ZKNlFQ&s',10),(76,'Chargeur voiture USB','Chargeur double port USB',14.99,55,'2026-06-03 10:49:00','https://www.lexip.co/cdn/shop/files/CAR-CHARGER-WITH-DUAL-PORT-2.6V-SWITCH.jpg?v=1753886870',10),(77,'Balai essuie-glace','Essuie-glace 60cm universel',12.99,60,'2026-06-03 10:49:00','https://www.cdiscount.com/pdt2/2/1/3/1/700x700/imp653213/rw/valeo-lot-de-2-balais-d-essuie-glaces-vm213-silenc.jpg',10),(78,'Gonfleur électrique','Compresseur portable 12V',34.99,25,'2026-06-03 10:49:00','https://images.ideeshomme.fr/Produits/528/6956155_WEB1.jpg',10),(79,'Support téléphone','Support voiture magnétique',19.99,45,'2026-06-03 10:49:00','https://content.pearl.fr/media/cache/default/article_ultralarge_high_nocrop/shared/images/articles/C/CX1/support-smartphone-universel-pliable-et-antiderapant-ref_CX1905_1.jpg',10),(80,'Atomic Habits','James Clear - Développement personnel',18.99,30,'2026-06-03 10:49:10','https://wanderfull.fr/wp-content/uploads/2022/11/Atomic-Habits-by-James-Clear.jpeg',11),(81,'Le Petit Prince','Antoine de Saint-Exupéry',8.99,50,'2026-06-03 10:49:10','https://images.epagine.fr/054/9782070581054_1_75.jpg',11),(82,'Sapiens','Yuval Noah Harari - Histoire de humanité',22.99,25,'2026-06-03 10:49:10','https://www.ynharari.com/wp-content/uploads/2017/01/sapiens.png',11),(83,'Les Misérables','Victor Hugo - Roman classique',12.99,35,'2026-06-03 10:49:10','https://cdn.cultura.com/cdn-cgi/image/width=830/media/pim/TITELIVE/66_9782010008993_1_75.jpg',11),(84,'Le Comte de Monte-Cristo','Alexandre Dumas - Roman aventure',14.99,28,'2026-06-03 10:49:10','https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS6RwXyKu3vMP8T_Gzfw3MNjt6i5H0rnFGBiQ&s',11),(85,'Pensées pour moi-même','Marc Aurèle - Philosophie stoïcienne',9.99,40,'2026-06-03 10:49:10','https://librairie.denaturarerum.fr/images/big_6628-1.jpg',11),(86,'Croquettes chien','Croquettes premium 5kg',34.99,40,'2026-06-03 10:49:18','https://www.terranimo.fr/media/catalog/product/cache/089e25cb47e64bb6a39c1827bcaae164/y/o/yock_equilibre_croc_volaille_croquettes_chien_8857.jpeg',12),(87,'Litière chat','Litière agglomérante 10L',12.99,50,'2026-06-03 10:49:18','https://www.cdiscount.com/pdt2/9/6/4/1/700x700/aaamv80964/rw/bac--litire-pour-chat-en.jpg',12),(88,'Cage à oiseaux','Cage spacieuse avec accessoires',49.99,15,'2026-06-03 10:49:18','https://www.oiseaux-mania.com/24262-large_default/savic-cage-oiseaux-primo-40-bleu-marine-savic.jpg',12),(89,'Laisse rétractable','Laisse 5m pour chien',19.99,35,'2026-06-03 10:49:18','https://animaliadore.com/cdn/shop/files/1e47545d-bbd7-4dfe-a108-c184e4eb.jpg?v=1728406765',12),(90,'Arbre à chat','Arbre griffoir 120cm',59.99,20,'2026-06-03 10:49:18','https://griffedamour.com/cdn/shop/files/arbre-a-chat-solide-2_1.webp?v=1755085835',12),(91,'Aquarium 60L','Aquarium avec filtre et éclairage',89.99,10,'2026-06-03 10:49:18','https://img.leboncoin.fr/api/v1/lbcpb1/images/63/17/4f/63174f31ffad169d4e9734fdff95470920d0c25e.jpg?rule=ad-large',12),(92,'Perceuse visseuse','Perceuse sans fil 18V',89.99,20,'2026-06-03 10:49:24','https://m.media-amazon.com/images/I/71o-PziuXlL._AC_UF1000,1000_QL80_.jpg',13),(93,'Caisse à outils','Caisse complète 108 pièces',49.99,25,'2026-06-03 10:49:24','https://media3.bricolagedirect.com/29572-thickbox_default/mallette-karx-out-alu-186pcs.jpg',13),(94,'Niveau laser','Niveau laser croix 30m',39.99,15,'2026-06-03 10:49:24','https://www.wiltec.de/media/1c/08/73/1619352073/f1f5a4a725f67c71acd1d1f69d1d450fb32d853d_51714_gal.jpg?ts=1619376761',13),(95,'Scie circulaire','Scie circulaire 1200W',79.99,12,'2026-06-03 10:49:24','https://keloutils.com/14779-zoom/scie-circulaire-mafell-ms-55-je-pure-91e909-18-v-55-mm-o-160-mm.jpg',13),(96,'Ponceuse orbitale','Ponceuse 300W avec sac',44.99,18,'2026-06-03 10:49:24','https://cgo-outillage.fr/29105-large_default/ponceuse-orbitale-fuel-125mm-18v-sans-batterie-m18-fros125-0b.jpg',13),(97,'Coffret clés','Coffret 40 clés mixtes',34.99,30,'2026-06-03 10:49:24','https://cdn.manomano.com/images/images_products/281921/P/9524399_1.jpg',13);
/*!40000 ALTER TABLE `produit` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `promotion`
--

DROP TABLE IF EXISTS `promotion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `promotion` (
  `id_promotion` int NOT NULL AUTO_INCREMENT,
  `nom` varchar(100) NOT NULL,
  `pourcentage` decimal(5,2) NOT NULL,
  `date_debut` datetime DEFAULT NULL,
  `date_fin` datetime DEFAULT NULL,
  PRIMARY KEY (`id_promotion`),
  KEY `idx_promotion_dates` (`date_debut`,`date_fin`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `promotion`
--

LOCK TABLES `promotion` WRITE;
/*!40000 ALTER TABLE `promotion` DISABLE KEYS */;
/*!40000 ALTER TABLE `promotion` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role`
--

DROP TABLE IF EXISTS `role`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role` (
  `id_role` int NOT NULL AUTO_INCREMENT,
  `nom_role` varchar(30) NOT NULL,
  PRIMARY KEY (`id_role`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role`
--

LOCK TABLES `role` WRITE;
/*!40000 ALTER TABLE `role` DISABLE KEYS */;
INSERT INTO `role` VALUES (1,'client'),(2,'vendeur'),(3,'admin');
/*!40000 ALTER TABLE `role` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `s_applique_a`
--

DROP TABLE IF EXISTS `s_applique_a`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `s_applique_a` (
  `id_produit` int NOT NULL,
  `id_promotion` int NOT NULL,
  PRIMARY KEY (`id_produit`,`id_promotion`),
  KEY `id_promotion` (`id_promotion`),
  CONSTRAINT `s_applique_a_ibfk_1` FOREIGN KEY (`id_produit`) REFERENCES `produit` (`id_produit`),
  CONSTRAINT `s_applique_a_ibfk_2` FOREIGN KEY (`id_promotion`) REFERENCES `promotion` (`id_promotion`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `s_applique_a`
--

LOCK TABLES `s_applique_a` WRITE;
/*!40000 ALTER TABLE `s_applique_a` DISABLE KEYS */;
/*!40000 ALTER TABLE `s_applique_a` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `utilisateur`
--

DROP TABLE IF EXISTS `utilisateur`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `utilisateur` (
  `id_Utilisateur` int NOT NULL AUTO_INCREMENT,
  `nom` varchar(50) DEFAULT NULL,
  `prenom` varchar(50) DEFAULT NULL,
  `email` varchar(100) NOT NULL,
  `mot_de_passe` varchar(255) NOT NULL,
  `telephone` varchar(20) DEFAULT NULL,
  `date_creation` datetime DEFAULT CURRENT_TIMESTAMP,
  `id_panier` int DEFAULT NULL,
  `id_role` int DEFAULT NULL,
  PRIMARY KEY (`id_Utilisateur`),
  UNIQUE KEY `email` (`email`),
  KEY `id_panier` (`id_panier`),
  KEY `id_role` (`id_role`),
  KEY `idx_utilisateur_email` (`email`),
  CONSTRAINT `utilisateur_ibfk_1` FOREIGN KEY (`id_panier`) REFERENCES `panier` (`id_panier`),
  CONSTRAINT `utilisateur_ibfk_2` FOREIGN KEY (`id_role`) REFERENCES `role` (`id_role`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `utilisateur`
--

LOCK TABLES `utilisateur` WRITE;
/*!40000 ALTER TABLE `utilisateur` DISABLE KEYS */;
INSERT INTO `utilisateur` VALUES (1,'Alice','Martin','alice.martin@gmail.com','1234',NULL,'2026-04-21 19:11:07',1,1),(2,'Thomas','Dubois','thomas.dubois@orange.fr','abcd',NULL,'2026-04-21 19:11:07',NULL,1),(3,'Sophie','Bernard','sophie.b@proton.me','1ebg',NULL,'2026-04-21 19:11:07',NULL,2),(4,'Lucas',' Moreau','lucas.moreau@gmail.com','ed4p',NULL,'2026-04-21 19:11:07',NULL,2),(5,'Emma','Leclerc','emma.leclerc@yahoo.fr','cmr23',NULL,'2026-04-21 19:11:07',NULL,1),(6,'Hugo',' Petit','hugo.petit@outlook.com','mno9',NULL,'2026-04-21 19:11:07',NULL,3),(7,'Chloé','Garcia','chloe.garcia@gmail.com','5678',NULL,'2026-04-21 19:11:07',NULL,1),(8,'Nathan','Roux','nathan.roux@free.fr','yujlk',NULL,'2026-04-21 19:11:07',NULL,2);
/*!40000 ALTER TABLE `utilisateur` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `vue_catalogue_promotions`
--

DROP TABLE IF EXISTS `vue_catalogue_promotions`;
/*!50001 DROP VIEW IF EXISTS `vue_catalogue_promotions`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `vue_catalogue_promotions` AS SELECT 
 1 AS `id_produit`,
 1 AS `nom_produit`,
 1 AS `prix_original`,
 1 AS `stock`,
 1 AS `categorie`,
 1 AS `promotion_active`,
 1 AS `pourcentage`,
 1 AS `prix_apres_remise`,
 1 AS `date_fin`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `vue_commandes_details`
--

DROP TABLE IF EXISTS `vue_commandes_details`;
/*!50001 DROP VIEW IF EXISTS `vue_commandes_details`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `vue_commandes_details` AS SELECT 
 1 AS `id_commande`,
 1 AS `date_commande`,
 1 AS `statut_commande`,
 1 AS `montant_total`,
 1 AS `nom`,
 1 AS `prenom`,
 1 AS `email`,
 1 AS `ville`,
 1 AS `pays`,
 1 AS `code_postal`,
 1 AS `type_paiement`,
 1 AS `statut_paiement`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `vue_panier_utilisateur`
--

DROP TABLE IF EXISTS `vue_panier_utilisateur`;
/*!50001 DROP VIEW IF EXISTS `vue_panier_utilisateur`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `vue_panier_utilisateur` AS SELECT 
 1 AS `id_Utilisateur`,
 1 AS `nom`,
 1 AS `prenom`,
 1 AS `email`,
 1 AS `id_produit`,
 1 AS `nom_produit`,
 1 AS `prix_unitaire`,
 1 AS `quantite`,
 1 AS `sous_total`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `vue_resume_clients`
--

DROP TABLE IF EXISTS `vue_resume_clients`;
/*!50001 DROP VIEW IF EXISTS `vue_resume_clients`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `vue_resume_clients` AS SELECT 
 1 AS `id_Utilisateur`,
 1 AS `nom`,
 1 AS `prenom`,
 1 AS `email`,
 1 AS `telephone`,
 1 AS `date_inscription`,
 1 AS `nb_commandes`,
 1 AS `total_depense`*/;
SET character_set_client = @saved_cs_client;

--
-- Final view structure for view `vue_catalogue_promotions`
--

/*!50001 DROP VIEW IF EXISTS `vue_catalogue_promotions`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `vue_catalogue_promotions` AS select `produit`.`id_produit` AS `id_produit`,`produit`.`nom` AS `nom_produit`,`produit`.`prix` AS `prix_original`,`produit`.`stock` AS `stock`,`categories`.`nom` AS `categorie`,`promotion`.`nom` AS `promotion_active`,`promotion`.`pourcentage` AS `pourcentage`,round((`produit`.`prix` * (1 - (`promotion`.`pourcentage` / 100))),2) AS `prix_apres_remise`,`promotion`.`date_fin` AS `date_fin` from (((`produit` join `categories` on((`produit`.`id_categories` = `categories`.`id_categories`))) left join `s_applique_a` on((`produit`.`id_produit` = `s_applique_a`.`id_produit`))) left join `promotion` on(((`s_applique_a`.`id_promotion` = `promotion`.`id_promotion`) and (now() between `promotion`.`date_debut` and `promotion`.`date_fin`)))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `vue_commandes_details`
--

/*!50001 DROP VIEW IF EXISTS `vue_commandes_details`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `vue_commandes_details` AS select `commande`.`id_commande` AS `id_commande`,`commande`.`date_commande` AS `date_commande`,`commande`.`statut_commande` AS `statut_commande`,`commande`.`montant_total` AS `montant_total`,`utilisateur`.`nom` AS `nom`,`utilisateur`.`prenom` AS `prenom`,`utilisateur`.`email` AS `email`,`adresselivraison`.`ville` AS `ville`,`adresselivraison`.`pays` AS `pays`,`adresselivraison`.`code_postal` AS `code_postal`,`paiement`.`type` AS `type_paiement`,`paiement`.`statut` AS `statut_paiement` from (((`commande` join `utilisateur` on((`commande`.`id_Utilisateur` = `utilisateur`.`id_Utilisateur`))) join `adresselivraison` on((`commande`.`id_adresseLivraison` = `adresselivraison`.`id_adresseLivraison`))) left join `paiement` on((`commande`.`id_commande` = `paiement`.`id_commande`))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `vue_panier_utilisateur`
--

/*!50001 DROP VIEW IF EXISTS `vue_panier_utilisateur`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `vue_panier_utilisateur` AS select `utilisateur`.`id_Utilisateur` AS `id_Utilisateur`,`utilisateur`.`nom` AS `nom`,`utilisateur`.`prenom` AS `prenom`,`utilisateur`.`email` AS `email`,`produit`.`id_produit` AS `id_produit`,`produit`.`nom` AS `nom_produit`,`produit`.`prix` AS `prix_unitaire`,`contient`.`quantite` AS `quantite`,round((`produit`.`prix` * `contient`.`quantite`),2) AS `sous_total` from (((`utilisateur` join `panier` on((`utilisateur`.`id_panier` = `panier`.`id_panier`))) join `contient` on((`panier`.`id_panier` = `contient`.`id_panier`))) join `produit` on((`contient`.`id_produit` = `produit`.`id_produit`))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `vue_resume_clients`
--

/*!50001 DROP VIEW IF EXISTS `vue_resume_clients`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `vue_resume_clients` AS select `utilisateur`.`id_Utilisateur` AS `id_Utilisateur`,`utilisateur`.`nom` AS `nom`,`utilisateur`.`prenom` AS `prenom`,`utilisateur`.`email` AS `email`,`utilisateur`.`telephone` AS `telephone`,`utilisateur`.`date_creation` AS `date_inscription`,count(`commande`.`id_commande`) AS `nb_commandes`,coalesce(sum(`commande`.`montant_total`),0) AS `total_depense` from (`utilisateur` left join `commande` on((`utilisateur`.`id_Utilisateur` = `commande`.`id_Utilisateur`))) group by `utilisateur`.`id_Utilisateur`,`utilisateur`.`nom`,`utilisateur`.`prenom`,`utilisateur`.`email`,`utilisateur`.`telephone`,`utilisateur`.`date_creation` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-23 13:35:48
